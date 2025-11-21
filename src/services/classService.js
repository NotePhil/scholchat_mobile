import { environment } from '../environment/environment';
import { storageService } from './storageService';

const API_BASE_URL = environment.baseUrl;

export const classService = {
  // Get classes for a specific user
  getClasses: async (userId) => {
    try {
      console.log('=== FETCHING CLASSES ===');
      console.log('User ID:', userId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/classes/user/${userId}`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch classes: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Classes fetched successfully:', data);
      console.log('Classes count:', data?.length || 0);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING CLASSES ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get classes with publication rights for a specific user
  getClassesWithPublicationRights: async (userId) => {
    try {
      console.log('=== FETCHING CLASSES WITH PUBLICATION RIGHTS ===');
      console.log('User ID:', userId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/droits-publication/utilisateurs/${userId}/classes`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch classes with publication rights: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Classes with publication rights fetched successfully:', data);
      console.log('Classes count:', data?.length || 0);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING CLASSES WITH PUBLICATION RIGHTS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get class details by ID
  getClassDetails: async (classId) => {
    try {
      console.log('=== FETCHING CLASS DETAILS ===');
      console.log('Class ID:', classId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/classes/${classId}`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch class details: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Class details fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING CLASS DETAILS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get access requests for a class
  getClassAccessRequests: async (classId) => {
    try {
      console.log('=== FETCHING CLASS ACCESS REQUESTS ===');
      console.log('Class ID:', classId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/acceder/classes/${classId}/demandes`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch class access requests: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Class access requests fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING CLASS ACCESS REQUESTS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get users with access to a class
  getClassUsers: async (classId) => {
    try {
      console.log('=== FETCHING CLASS USERS ===');
      console.log('Class ID:', classId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/acceder/classes/${classId}/utilisateurs`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch class users: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Class users fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING CLASS USERS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get all etablissements
  getEtablissements: async () => {
    try {
      console.log('=== FETCHING ETABLISSEMENTS ===');
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/etablissements`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch etablissements: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Etablissements fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING ETABLISSEMENTS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get all professors
  getProfessors: async () => {
    try {
      console.log('=== FETCHING PROFESSORS ===');
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/professeurs`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch professors: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Professors fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING PROFESSORS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Create a new class
  createClass: async (classData) => {
    try {
      console.log('=== CREATING CLASS ===');
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/classes`;
      console.log('Request URL:', url);
      console.log('Request body:', JSON.stringify(classData, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(classData),
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to create class: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Class created successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR CREATING CLASS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Grant publication rights
  grantPublicationRights: async (userId, classId, canPublish = true, canModerate = true) => {
    try {
      console.log('=== GRANTING PUBLICATION RIGHTS ===');
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/droits-publication/${userId}/${classId}?peutPublier=${canPublish}&peutModerer=${canModerate}`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to grant publication rights: ${response.status} ${errorText}`);
      }
      
      // Check if response has content before parsing JSON
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      let data = null;
      if (responseText && responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.log('Response is not JSON, treating as success');
          data = { success: true };
        }
      } else {
        console.log('Empty response, treating as success');
        data = { success: true };
      }
      
      console.log('Publication rights granted successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR GRANTING PUBLICATION RIGHTS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Remove user access from class
  removeUserAccess: async (userId, classId) => {
    try {
      console.log('=== REMOVING USER ACCESS ===');
      console.log('User ID:', userId, 'Class ID:', classId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/acceder/${userId}/${classId}`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to remove user access: ${response.status} ${errorText}`);
      }
      
      console.log('User access removed successfully');
      return { success: true };
    } catch (error) {
      console.error('=== ERROR REMOVING USER ACCESS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Assign moderator to class
  assignModerator: async (classId, moderatorId) => {
    try {
      console.log('=== ASSIGNING MODERATOR ===');
      console.log('Class ID:', classId, 'Moderator ID:', moderatorId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/classes/${classId}/moderator/${moderatorId}`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to assign moderator: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Moderator assigned successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR ASSIGNING MODERATOR ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Search professors by name or email
  searchProfessors: async (searchTerm) => {
    try {
      console.log('=== SEARCHING PROFESSORS ===');
      console.log('Search term:', searchTerm);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/professeurs`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to search professors: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Professors search results:', data);
      
      // Filter results based on search term
      const filteredResults = data.filter(professor => 
        professor.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        professor.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        professor.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      console.log('Filtered professors:', filteredResults);
      return filteredResults;
    } catch (error) {
      console.error('=== ERROR SEARCHING PROFESSORS ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Approve access request
  approveAccessRequest: async (requestId) => {
    try {
      console.log('=== APPROVING ACCESS REQUEST ===');
      console.log('Request ID:', requestId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/acceder/demandes/${requestId}/approve`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to approve access request: ${response.status} ${errorText}`);
      }
      
      console.log('Access request approved successfully');
      return { success: true };
    } catch (error) {
      console.error('=== ERROR APPROVING ACCESS REQUEST ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Reject access request
  rejectAccessRequest: async (requestId, rejectionReason) => {
    try {
      console.log('=== REJECTING ACCESS REQUEST ===');
      console.log('Request ID:', requestId, 'Reason:', rejectionReason);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/acceder/demandes/${requestId}/reject?motifRejet=${encodeURIComponent(rejectionReason)}`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to reject access request: ${response.status} ${errorText}`);
      }
      
      console.log('Access request rejected successfully');
      return { success: true };
    } catch (error) {
      console.error('=== ERROR REJECTING ACCESS REQUEST ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get class moderators
  getClassModerators: async (classId) => {
    try {
      console.log('=== FETCHING CLASS MODERATORS ===');
      console.log('Class ID:', classId);
      const token = await storageService.getUserToken();
      console.log('Token retrieved:', token ? 'Token exists' : 'No token');
      
      const url = `${API_BASE_URL}/classes/${classId}/moderators`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch class moderators: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Class moderators fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING CLASS MODERATORS ===');
      console.error('Error details:', error);
      throw error;
    }
  }
};