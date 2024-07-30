"use client";
import React, { createContext, useState, useEffect, useContext } from 'react';
import { v4 as uuidv4 } from 'uuid';


const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [isLoadingUserId, setIsLoadingUserId] = useState(true);

  useEffect(() => {
    const getOrCreateUserId = async () => {
      let id = localStorage.getItem('userId');
      if (!id) {
        id = uuidv4(); 
        localStorage.setItem('userId', id);
      }
      setUserId(id);
      setIsLoadingUserId(false);
    };

    getOrCreateUserId();
  }, []);

  return (
    <UserContext.Provider value={{ userId, isLoadingUserId }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);