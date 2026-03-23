import { fetchApi, USE_MOCKS } from './core';

export const login = async (credentials: any) => {
    if (USE_MOCKS) {
        const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidGVuYW50cyI6WzFdLCJleHAiOjI1MjQ2MDgwMDB9.dummy-signature";
        return { access_token: mockToken, token_type: "bearer" };
    }
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    return fetchApi('/auth/login', { method: 'POST', body: formData });
};
