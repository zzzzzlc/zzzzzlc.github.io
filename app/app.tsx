import React from 'react';
import Router from './router';
import { ThemeProvider } from './theme/ThemeProvider';

export default function App() {
    return (
        <ThemeProvider>
            <Router />
        </ThemeProvider>
    );
}
