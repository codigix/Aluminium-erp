import os
import json
import base64

# Third-party library imports with safety fallbacks
try:
    import mysql.connector
except ImportError:
    mysql = None

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

try:
    import openai
except ImportError:
    openai = None

# Set your Tesseract path if running on Windows (Optional)
# if pytesseract:
#     pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Configure OpenAI API Key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-api-key-here")

# Configure Database
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "backend",
    "database": "sptech_prod"
}

def extract_text_from_file(file_path):
    """
    OCR Layer: Extracts text from Image (JPG/PNG) or PDF file
    """
    if not pytesseract or not Image:
        raise ImportError("pytesseract or PIL is not installed. Run: pip install pytesseract pillow")

    ext = os.path.splitext(file_path)[1].lower()
    text = ""

    if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']:
        print("[OCR] Processing Image via Tesseract...")
        image = Image.open(file_path)
        text = pytesseract.image_to_string(image, lang='eng+hin')

    elif ext == '.pdf':
        if not convert_from_path:
            raise ImportError("pdf2image is not installed. Run: pip install pdf2image")
        print("[OCR] Processing PDF pages via Tesseract...")
        pages = convert_from_path(file_path)
        for page in pages:
            text += pytesseract.image_to_string(page, lang='eng+hin') + "\n"

    else:
        raise ValueError("Unsupported file format. Please provide image or PDF.")

    return text.strip()

def parse_po_with_ai(ocr_text):
    """
    AI Layer: Uses GPT-4o / LLM to structure extracted OCR text into JSON
    """
    if not openai:
        raise ImportError("openai package is not installed. Run: pip install openai")

    print("[AI] Sending OCR text to GPT LLM for structured extraction...")

    system_prompt = """
    You are an expert PO (Purchase Order) Data Extraction AI for an Aluminium Manufacturing ERP.
    Extract key header info and line items from the provided OCR text.

    Return ONLY a single valid JSON object with the following structure:
    {
        "companyName": "Company Name",
        "customerGstin": "GSTIN number",
        "poNumber": "PO Number",
        "poDate": "YYYY-MM-DD",
        "paymentTerms": "e.g. 30 Days",
        "items": [
            {
                "drawingNo": "Drawing / Item Code e.g. DRG-10025",
                "description": "Item Description",
                "hsnCode": "HSN Code",
                "quantity": 100,
                "unit": "NOS",
                "rate": 250.00,
                "cgstPercent": 9,
                "sgstPercent": 9,
                "igstPercent": 0,
                "deliveryDate": "YYYY-MM-DD"
            }
        ]
    }
    """

    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"OCR Extracted Text:\n\n{ocr_text}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.1
    )

    content = response.choices[0].message.content
    return json.loads(content)

def search_drawing_master(drawing_no):
    """
    MySQL Layer: Queries MySQL drawing master table to enrich line items
    """
    if not mysql:
        print("[Database Warning] mysql-connector-python package is not installed.")
        return None

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT id, drawing_no, drawing_name, description, hsn_code, unit, 
                   material_grade, finish, standard_rate, gst_percent, weight_per_unit
            FROM customer_drawings 
            WHERE drawing_no = %s OR id = %s LIMIT 1
        """
        cursor.execute(query, (drawing_no, drawing_no))
        result = cursor.fetchone()

        cursor.close()
        conn.close()
        return result
    except Exception as e:
        print(f"[Database Error]: {e}")
        return None

def auto_fill_customer_po(file_path):
    """
    Complete OCR -> AI -> MySQL Auto Fill Pipeline
    """
    # Step 1: Perform OCR
    ocr_text = extract_text_from_file(file_path)
    if not ocr_text:
        print("Failed to extract text via OCR.")
        return None

    # Step 2: Extract PO Data using AI LLM
    po_data = parse_po_with_ai(ocr_text)

    # Step 3: MySQL Drawing Master Auto-Fill
    enriched_items = []
    for item in po_data.get("items", []):
        drawing_no = item.get("drawingNo", "")
        master_info = search_drawing_master(drawing_no) if drawing_no else None

        if master_info:
            print(f"[MySQL Match] Found Drawing Master for: {drawing_no}")
            gst_percent = float(master_info.get("gst_percent") or 18)
            item.update({
                "drawingMasterFound": True,
                "drawingId": master_info.get("id"),
                "description": item.get("description") or master_info.get("description") or master_info.get("drawing_name"),
                "hsnCode": item.get("hsnCode") or master_info.get("hsn_code"),
                "unit": item.get("unit") or master_info.get("unit") or "NOS",
                "materialGrade": master_info.get("material_grade"),
                "finish": master_info.get("finish"),
                "rate": item.get("rate") if item.get("rate", 0) > 0 else float(master_info.get("standard_rate") or 0),
                "cgstPercent": item.get("cgstPercent") or (gst_percent / 2),
                "sgstPercent": item.get("sgstPercent") or (gst_percent / 2),
                "weightPerUnit": master_info.get("weight_per_unit")
            })
        else:
            item["drawingMasterFound"] = False

        enriched_items.append(item)

    po_data["items"] = enriched_items
    return po_data

# Example Execution:
if __name__ == "__main__":
    sample_file = "sample_po.jpg"  # Or "sample_po.pdf"
    if os.path.exists(sample_file):
        result = auto_fill_customer_po(sample_file)
        print("\n--- Final Extracted & Auto-Filled PO Data ---")
        print(json.dumps(result, indent=2))
    else:
        print(f"Please provide a valid PO file path at {sample_file}")
