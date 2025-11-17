import { environment } from '../environment/environment';
import { storageService } from './storageService';

const API_BASE_URL = environment.baseUrl;

export const classService = {
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
      
      const data = await response.json();
      console.log('Publication rights granted successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR GRANTING PUBLICATION RIGHTS ===');
      console.error('Error details:', error);
      throw error;
    }
  }
};