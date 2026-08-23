// Documents page client-side functionality
export function initDocumentsPage() {
  // Modal handling
  const uploadBtn = document.getElementById('upload-btn');
  const modal = document.getElementById('upload-modal');
  const closeModal = document.getElementById('close-modal');
  const cancelUpload = document.getElementById('cancel-upload');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadForm = document.getElementById('upload-form');

  function openModal() {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeModalFn() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
    uploadForm.reset();
  }

  uploadBtn?.addEventListener('click', openModal);
  closeModal?.addEventListener('click', closeModalFn);
  cancelUpload?.addEventListener('click', closeModalFn);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModalFn();
  });

  // Drag and drop
  dropZone?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-primary', 'bg-canvas-soft');
  });
  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-primary', 'bg-canvas-soft');
  });
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-primary', 'bg-canvas-soft');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateFileName();
    }
  });
  fileInput?.addEventListener('change', updateFileName);

  function updateFileName() {
    if (fileInput?.files?.length) {
      const file = fileInput.files[0];
      const p = dropZone?.querySelector('p');
      if (p) p.textContent = file.name;
    }
  }

  // Form submission
  uploadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput?.files?.[0];
    const url = (document.getElementById('url-input') as HTMLInputElement)?.value;

    if (!file && !url) {
      alert('Please select a file or enter a URL');
      return;
    }

    const submitBtn = document.getElementById('submit-upload');
    submitBtn!.disabled = true;
    submitBtn!.textContent = 'Uploading...';

    try {
      // In real implementation, would:
      // 1. Get presigned URL from /api/documents/upload
      // 2. Upload file to R2
      // 3. Confirm upload at /api/documents/:id/confirm
      // 4. Poll for status
      
      await new Promise(r => setTimeout(r, 1500)); // Simulate
      closeModalFn();
      // Refresh page or update list
      window.location.reload();
    } catch (error) {
      alert('Upload failed. Please try again.');
    } finally {
      submitBtn!.disabled = false;
      submitBtn!.textContent = 'Upload & Process';
    }
  });
}