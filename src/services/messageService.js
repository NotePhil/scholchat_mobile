import { environment } from '../environment/environment';
import { storageService } from './storageService';

const API_BASE_URL = environment.baseUrl;

export const messageService = {
  // Send individual message
  sendIndividualMessage: async (messageData) => {
    try {
      console.log('=== SENDING INDIVIDUAL MESSAGE ===');
      const token = await storageService.getUserToken();
      
      const url = `${API_BASE_URL}/messages`;
      console.log('Request URL:', url);
      console.log('Message data:', messageData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Message sent successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR SENDING MESSAGE ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Send group message
  sendGroupMessage: async (messageData) => {
    try {
      console.log('=== SENDING GROUP MESSAGE ===');
      const token = await storageService.getUserToken();
      
      const url = `${API_BASE_URL}/messages/group`;
      console.log('Request URL:', url);
      console.log('Message data:', messageData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to send group message: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Group message sent successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR SENDING GROUP MESSAGE ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get sent messages for a user
  getSentMessages: async (userId) => {
    try {
      console.log('=== FETCHING SENT MESSAGES ===');
      console.log('User ID:', userId);
      const token = await storageService.getUserToken();
      const url = `${API_BASE_URL}/messages/utilisateur/${userId}/sent`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch sent messages: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Sent messages fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING SENT MESSAGES ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get received messages for a user
  getReceivedMessages: async (userId) => {
    try {
      console.log('=== FETCHING RECEIVED MESSAGES ===');
      console.log('User ID:', userId);
      const token = await storageService.getUserToken();
      const url = `${API_BASE_URL}/messages/utilisateur/${userId}/received`;
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch received messages: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Received messages fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('=== ERROR FETCHING RECEIVED MESSAGES ===');
      console.error('Error details:', error);
      throw error;
    }
  },

  // Get all messages for a user (combined sent and received)
  getUserMessages: async (userId) => {
    try {
      console.log('=== FETCHING ALL USER MESSAGES ===');
      console.log('User ID:', userId);
      
      const [sentMessages, receivedMessages] = await Promise.all([
        messageService.getSentMessages(userId),
        messageService.getReceivedMessages(userId)
      ]);
      
      const allMessages = [
        ...sentMessages.map(msg => ({ ...msg, type: 'sent' })),
        ...receivedMessages.map(msg => ({ ...msg, type: 'received' }))
      ];
      
      console.log('Combined messages count:', allMessages.length);
      console.log('Sent:', sentMessages.length, 'Received:', receivedMessages.length);
      
      return allMessages.sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));
    } catch (error) {
      console.error('=== ERROR FETCHING ALL MESSAGES ===');
      console.error('Error details:', error);
      throw error;
    }
  }
};