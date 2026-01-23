import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
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
    title
  });
};

export const successToast = (message) => showToast('success', message);
export const errorToast = (message) => showToast('error', message);
export const warningToast = (message) => showToast('warning', message);
export const infoToast = (message) => showToast('info', message);

export default showToast;
