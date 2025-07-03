import React from "react";

const Error404: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '500px',
      height: '240px',
      backgroundColor: '#e6f3ff',
      border: '1px solid #ccc',
      margin: 'auto',
      position: 'absolute',
      top: '45%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      borderRadius: '8px'
    }}>
      <div style={{
        fontSize: '72px',
        fontWeight: 'bold',
        color: '#333'
      }}>404</div>
      <div style={{
        fontSize: '24px',
        color: '#333',
        marginTop: '50px'
      }}>Page not found</div>
    </div>
  );
}

export default Error404;