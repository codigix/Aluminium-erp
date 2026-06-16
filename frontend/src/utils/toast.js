import Swal from 'sweetalert2';

const getToastPosition = () => {
  try {
    const path = window.location.pathname;
    if (path.includes('/bom-creation') || path.includes('/bom-form')) {
      return 'bottom-start';
    }
  } catch (e) {
    // Fallback if window is not defined (e.g., in SSR or test environments)
  }
  return 'bottom-end';
};

const Toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

export const showToast = (icon, title) => {
  Toast.fire({
    icon,
    title,
    position: getToastPosition()
  });
};

export const successToast = (message) => showToast('success', message);
export const errorToast = (message) => showToast('error', message);
export const warningToast = (message) => showToast('warning', message);
export const infoToast = (message) => showToast('info', message);

export default showToast;
