import os
import json
import pymysql
import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import pdfplumber
import openai
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="Aluminium ERP - AI & OCR PO Processing API")

# Enable CORS for React Frontend & Node Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set Tesseract executable path if specified in environment or standard Windows path
TESSERACT_PATH = os.getenv("TESSERACT_PATH", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if os.path.exists(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

def get_db_connection():
    """Connect to MySQL database"""
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "backend"),
        database=os.getenv("DB_NAME", "sptech_prod"),
        port=int(os.getenv("DB_PORT", 3306)),
        cursorclass=pymysql.cursors.DictCursor
    )

def extract_text_from_document(file_bytes: bytes, filename: str) -> str:
    """Extract text using OCR and pdfplumber"""
    ext = os.path.splitext(filename)[1].lower()
    text = ""

    # Temporary file storage
    temp_path = f"temp_{filename}"
    with open(temp_path, "wb") as f:
        f.write(file_bytes)

    try:
        if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff']:
            image = Image.open(temp_path)
            text = pytesseract.image_to_string(image, lang='eng+hin')
        elif ext == '.pdf':
            # 1. Try digital text extraction first
            with pdfplumber.open(temp_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"

            # 2. OCR fallback for scanned PDFs
            if not text.strip():
                images = convert_from_path(temp_path)
                for img in images:
                    text += pytesseract.image_to_string(img, lang='eng+hin') + "\n"
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return text.strip()

def parse_po_with_ai(ocr_text: str) -> dict:
    """Send OCR text to Gemini or OpenAI LLM to structure PO JSON"""
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")

    system_prompt = """
    You are an expert PO (Purchase Order) Data Extraction AI for an Aluminium Manufacturing ERP.
    Extract key header details and ALL line items from the provided OCR text of a Purchase Order.

    CRITICAL RULES FOR ACCURACY:
    1. poNumber: Look for "Purchase Order No.", "PO No", "PO Number". Clean any leading symbols like ".:". Example: "PO24-07-2026-002".
    2. companyName: Extract the buyer/customer company name from "CUSTOMER DETAILS" or "Customer Code" (e.g., "Sidel India Pvt Ltd"). Do NOT confuse with supplier/issuer name "SP TECHPIONEER PRIVATE LIMITED".
    3. drawingNo: Extract the Drawing No or Item Code (e.g. "DRG: 09001544901" or "09001544901"). Do NOT put HSN codes (like 84779000) inside drawingNo!
    4. description: Extract item description text (e.g. "SUPPORT COLUMN COMBI AOR").
    5. hsnCode: Extract 8-digit HSN numbers (e.g. "84779000").
    6. rate: Extract the unit rate / price per item as a number (e.g. 85247.00). Do NOT confuse quantity (e.g., 4.000) with rate.
    7. quantity: Numeric quantity of items ordered.
    8. date fields: Return dates in ISO format "YYYY-MM-DD" or "DD-MM-YYYY".

    Return ONLY a single valid JSON object matching this structure:
    {
        "companyName": "Buyer / Customer Company Name",
        "customerGstin": "Customer GSTIN",
        "poNumber": "Clean PO Number",
        "poDate": "YYYY-MM-DD",
        "paymentTerms": "Payment Terms",
        "creditDays": 30,
        "deliveryTerms": "Delivery Terms",
        "remarks": "Notes",
        "items": [
            {
                "drawingNo": "Exact Drawing No or Part Code",
                "itemCode": "Item Code",
                "description": "Item Description",
                "hsnCode": "HSN Code",
                "quantity": 4,
                "unit": "NOS",
                "rate": 85247.00,
                "cgstPercent": 9,
                "sgstPercent": 9,
                "igstPercent": 0,
                "deliveryDate": "YYYY-MM-DD"
            }
        ]
    }
    """

    gemini_error = None
    # 1. Try Gemini Client if key configured
    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            prompt = f"{system_prompt}\n\nOCR Extracted Text:\n\n{ocr_text}"
            response = client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
                contents=prompt
            )
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text.replace("```json", "", 1).rstrip("`").strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.replace("```", "", 1).rstrip("`").strip()
            return json.loads(raw_text)
        except Exception as e:
            gemini_error = str(e)
            print(f"[Gemini Extraction Error]: {e}, falling back to OpenAI if available")

    # 2. Try OpenAI Client
    if openai_key:
        try:
            client = openai.OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"OCR Extracted Text:\n\n{ocr_text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"[OpenAI Extraction Error]: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI Error: {str(e)}")

    if gemini_error:
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {gemini_error}")

    raise HTTPException(status_code=500, detail="Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured in backend/.env")

def enrich_with_mysql_drawing_master(extracted_data: dict) -> dict:
    """Auto-fill item details from MySQL customer_drawings table"""
    items = extracted_data.get("items", [])
    if not items:
        return extracted_data

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            enriched_items = []
            for item in items:
                drawing_no = (item.get("drawingNo") or item.get("itemCode") or "").strip()
                if not drawing_no:
                    enriched_items.append(item)
                    continue

                sql = """
                    SELECT id, drawing_no, drawing_name, description, hsn_code, unit, 
                           material_grade, finish, standard_rate, gst_percent, weight_per_unit
                    FROM customer_drawings 
                    WHERE drawing_no = %s OR id = %s LIMIT 1
                """
                cursor.execute(sql, (drawing_no, drawing_no))
                master = cursor.fetchone()

                if master:
                    gst = float(master.get("gst_percent") or 18)
                    item.update({
                        "drawingMasterFound": True,
                        "drawingId": master.get("id"),
                        "drawingNo": master.get("drawing_no") or item.get("drawingNo"),
                        "description": item.get("description") or master.get("description") or master.get("drawing_name"),
                        "hsnCode": item.get("hsnCode") or master.get("hsn_code"),
                        "unit": item.get("unit") or master.get("unit") or "NOS",
                        "materialGrade": master.get("material_grade"),
                        "finish": master.get("finish"),
                        "rate": item.get("rate") if item.get("rate", 0) > 0 else float(master.get("standard_rate") or 0),
                        "cgstPercent": item.get("cgstPercent") or (gst / 2),
                        "sgstPercent": item.get("sgstPercent") or (gst / 2),
                        "weightPerUnit": master.get("weight_per_unit")
                    })
                else:
                    item["drawingMasterFound"] = False

                enriched_items.append(item)

            extracted_data["items"] = enriched_items
    finally:
        conn.close()

    return extracted_data

@app.post("/api/ai/parse-po")
async def parse_po_endpoint(file: UploadFile = File(...)):
    """FastAPI endpoint to process uploaded PO document/photo"""
    file_bytes = await file.read()
    ocr_text = extract_text_from_document(file_bytes, file.filename)

    if not ocr_text:
        raise HTTPException(status_code=400, detail="Could not extract text from document.")

    po_data = parse_po_with_ai(ocr_text)
    enriched_data = enrich_with_mysql_drawing_master(po_data)

    return {
        "status": "success",
        "ocrEngine": "FastAPI_PyTesseract_PdfPlumber",
        "extractedData": enriched_data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
