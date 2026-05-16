"use client";

import { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';

export default function Home() {
  const [roomName, setRoomName] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [role, setRole] = useState('operator');

  useEffect(() => {
    // Define a URL dinamicamente para usar a mesma origem do front-end, apontando para a nossa rota de proxy.
    // Assim não precisamos nos preocupar com IPs hardcoded, funcionando tanto em localhost quanto via IP da LAN.
    setServerUrl(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit`);
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!roomName || !participantName) {
      setError('Por favor, informe o Nome da Sala e o Nome do Usuário.');
      return;
    }

    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName }),
      });

      if (!response.ok) {
        throw new Error('Falha ao obter o token da API.');
      }

      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      console.error('Erro na geração do token:', err);
      setError('Não foi possível conectar. Verifique se o servidor backend está online.');
    }
  };

  if (token && serverUrl) {
    return (
      <LiveKitRoom
        video={role === 'operator'} // Habilita vídeo apenas para o Operator
        audio={true} // Áudio sempre habilitado para ambos (full-duplex)
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        style={{ height: '100vh', width: '100vw' }}
        onDisconnected={() => setToken('')}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  // Se não tem token, mostramos a tela de login (formulário)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#1a1a1a', marginBottom: '2rem' }}>Reunião Local (WebRTC)</h1>
      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px', background: '#fff', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        {error && <div style={{ color: '#d93025', fontSize: '0.9rem', backgroundColor: '#fce8e6', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#333' }}>Seu Nome</label>
          <input 
            type="text" 
            value={participantName} 
            onChange={(e) => setParticipantName(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem' }}
            required
            placeholder="Ex: João"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#333' }}>Nome da Sala</label>
          <input 
            type="text" 
            value={roomName} 
            onChange={(e) => setRoomName(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem' }}
            required
            placeholder="Ex: SalaPrincipal"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#333' }}>Seu Papel</label>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem', background: '#fff' }}
          >
            <option value="operator">Operator (Envia e Assiste)</option>
            <option value="guide">Guide (Apenas Assiste)</option>
          </select>
        </div>

        <button type="submit" style={{ marginTop: '1rem', padding: '0.85rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 600, transition: 'background 0.2s' }}
          onMouseOver={(e) => e.target.style.background = '#0051b3'}
          onMouseOut={(e) => e.target.style.background = '#0070f3'}
        >
          Entrar na Sala
        </button>
      </form>
    </div>
  );
}
