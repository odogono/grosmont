import React from 'react';


export const TomatoHighlight = ({children}) => (
    <div style={{ padding: '20px', backgroundColor: 'tomato' }}>
    <h3>{children}</h3>
    </div>
);