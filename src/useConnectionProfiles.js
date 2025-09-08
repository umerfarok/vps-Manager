import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export function useConnectionProfiles() {
  const [profiles, setProfiles] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('connectionProfiles');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('connectionProfiles', JSON.stringify(profiles));
    }
  }, [profiles]);

  const saveProfile = (profileData) => {
    const newProfile = {
      id: uuidv4(),
      name: profileData.name || `Server ${profiles.length + 1}`,
      host: profileData.host,
      port: profileData.port || '22',
      username: profileData.username,
      authType: profileData.authType || 'password',
      password: profileData.authType === 'password' ? profileData.password : '',
      privateKey: profileData.authType === 'privateKey' ? profileData.privateKey : '',
      passphrase: profileData.passphrase || '',
      createdAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0
    };

    setProfiles(prev => [...prev, newProfile]);
    return newProfile;
  };

  const updateProfile = (id, updates) => {
    setProfiles(prev => prev.map(profile =>
      profile.id === id
        ? { ...profile, ...updates, lastModified: new Date().toISOString() }
        : profile
    ));
  };

  const deleteProfile = (id) => {
    setProfiles(prev => prev.filter(profile => profile.id !== id));
  };

  const getProfile = (id) => {
    return profiles.find(profile => profile.id === id);
  };

  const markProfileUsed = (id) => {
    setProfiles(prev => prev.map(profile =>
      profile.id === id
        ? {
            ...profile,
            lastUsed: new Date().toISOString(),
            useCount: profile.useCount + 1
          }
        : profile
    ));
  };

  const duplicateProfile = (id) => {
    const original = getProfile(id);
    if (!original) return null;

    const duplicate = {
      ...original,
      id: uuidv4(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0
    };

    setProfiles(prev => [...prev, duplicate]);
    return duplicate;
  };

  const exportProfiles = () => {
    return JSON.stringify(profiles, null, 2);
  };

  const importProfiles = (jsonData) => {
    try {
      const importedProfiles = JSON.parse(jsonData);
      if (!Array.isArray(importedProfiles)) {
        throw new Error('Invalid profile data format');
      }

      // Validate and sanitize imported profiles
      const validatedProfiles = importedProfiles.map(profile => ({
        ...profile,
        id: profile.id || uuidv4(),
        createdAt: profile.createdAt || new Date().toISOString(),
        lastUsed: profile.lastUsed || null,
        useCount: profile.useCount || 0
      }));

      setProfiles(prev => [...prev, ...validatedProfiles]);
      return { success: true, imported: validatedProfiles.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const getRecentProfiles = (limit = 5) => {
    return profiles
      .filter(profile => profile.lastUsed)
      .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
      .slice(0, limit);
  };

  const getMostUsedProfiles = (limit = 5) => {
    return profiles
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, limit);
  };

  return {
    profiles,
    saveProfile,
    updateProfile,
    deleteProfile,
    getProfile,
    markProfileUsed,
    duplicateProfile,
    exportProfiles,
    importProfiles,
    getRecentProfiles,
    getMostUsedProfiles,
    // Utility functions
    hasProfiles: profiles.length > 0,
    totalProfiles: profiles.length
  };
}
