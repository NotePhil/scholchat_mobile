import { environment } from '../../environment/environment';

const API_BASE_URL = environment.baseUrl;

export const authService = {
  login: async (email, password) => {
    try {
      console.log('Login attempt to:', `${API_BASE_URL}/auth/login`);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  createProfessor: async (userData) => {
    try {
      const requestBody = {
        type: "professeur",
        nom: userData.lastName,
        prenom: userData.firstName,
        email: userData.email,
        telephone: userData.phone,
        adresse: userData.address,
        matriculeProfesseur: userData.teacherMatricule || ""
      };
      
      console.log('Creating professor at:', `${API_BASE_URL}/utilisateurs`);
      console.log('Request body:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/utilisateurs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('Professor creation response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Professor creation failed. Response:', errorText);
        throw new Error(`Professor creation failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Professor creation successful:', result);
      return result;
    } catch (error) {
      console.error('Professor creation error:', error);
      throw error;
    }
  },

  getPresignedUrl: async (fileName, contentType, ownerId, documentType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/media/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          contentType,
          mediaType: "DOCUMENT",
          ownerId,
          documentType
        }),
      });
      
      if (!response.ok) {
        throw new Error('Presigned URL generation failed');
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  uploadFile: async (presignedUrl, file) => {
    try {
      console.log('Uploading to MinIO URL:', presignedUrl);
      
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.mimeType,
        },
        body: {
          uri: file.uri,
          type: file.mimeType,
          name: file.name,
        },
      });
      
      console.log('MinIO upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('MinIO upload failed:', errorText);
        throw new Error(`File upload failed: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  },

  updateProfessorUrls: async (professorId, urls) => {
    try {
      const response = await fetch(`${API_BASE_URL}/utilisateurs/${professorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "professeur",
          cniUrlRecto: urls.cniRecto,
          cniUrlVerso: urls.cniVerso,
          selfieUrl: urls.selfie
        }),
      });
      
      if (!response.ok) {
        throw new Error('Professor update failed');
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
};