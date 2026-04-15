export class FileImportService {
    private readonly baseUrl = '/api/configs/upload';
  
    async uploadFiles(files: File[], userId: string): Promise<void> {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('userId', userId);
  
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: formData
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload files');
      }
    }
  }
  
  export const fileImportService = new FileImportService();