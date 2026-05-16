"use client";

import { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  DisconnectButton,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

// =========================================================
// VIEW DO GUIDE (Apenas assiste o Operador)
// =========================================================
function GuideView() {
  // Pega todos os vídeos publicados na sala, mas filtra para não mostrar o do usuário local
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false }
  ]).filter((t) => !t.participant.isLocal);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#111', overflow: 'hidden' }}>
      <GridLayout tracks={tracks} style={{ flex: 1, overflow: 'hidden' }}>
        <ParticipantTile />
      </GridLayout>
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', backgroundColor: '#222' }}>
        <DisconnectButton style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: '#d93025', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          Encerrar Chamada
        </DisconnectButton>
      </div>
    </div>
  );
}

// =========================================================
// VIEW DO OPERATOR (Apenas envia e vê a própria câmera)
// =========================================================
function OperatorView() {
  const { localParticipant } = useLocalParticipant();
  
  // Pega apenas o track de vídeo do próprio usuário local (Operator)
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false }
  ]).filter((t) => t.participant.identity === localParticipant.identity);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#111', overflow: 'hidden' }}>
      <GridLayout tracks={tracks} style={{ flex: 1, overflow: 'hidden' }}>
        <ParticipantTile />
      </GridLayout>
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', backgroundColor: '#222' }}>
        <DisconnectButton style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: '#d93025', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          Encerrar Chamada
        </DisconnectButton>
      </div>
    </div>
  );
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================
export default function Home() {
  const [roomName, setRoomName] = useState('Sala1');
  const [role, setRole] = useState('operator');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    setServerUrl(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit`);
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    
    // Geração automática do nome do participante baseado no papel
    const participantName = `${role}-${Math.floor(Math.random() * 10000)}`;

    if (!roomName) {
      setError('Por favor, selecione uma sala.');
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
    // Configuração de vídeo para o Operator.
    // 'environment' = Câmera traseira do celular
    // 'user' = Câmera frontal (Selfie) do celular
    // Pelo seu prompt, parece que você queria a câmera oposta à "da frente".
    // Estou configurando para a câmera TRASEIRA (environment). Se quiser a selfie, troque para 'user'.
    const operatorVideoConfig = role === 'operator' ? { facingMode: 'environment' } : false;

    return (
      <LiveKitRoom
        video={operatorVideoConfig} 
        audio={true} // Full-duplex
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        style={{ height: '100dvh', width: '100vw', overflow: 'hidden' }}
        onDisconnected={() => setToken('')}
      >
        {role === 'operator' ? <OperatorView /> : <GuideView />}
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', fontFamily: 'sans-serif', padding: '1rem', boxSizing: 'border-box' }}>
      <h1 style={{ color: '#1a1a1a', marginBottom: '2rem', textAlign: 'center' }}>Reunião Local (WebRTC)</h1>
      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px', background: '#fff', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        {error && <div style={{ color: '#d93025', fontSize: '0.9rem', backgroundColor: '#fce8e6', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}
        
        {/* Campo "Seu Nome" foi removido. */}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#333' }}>Selecione a Sala</label>
          <select 
            value={roomName} 
            onChange={(e) => setRoomName(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem', background: '#fff' }}
          >
            <option value="Sala1">Sala 1</option>
            <option value="Sala2">Sala 2</option>
            <option value="Sala3">Sala 3</option>
            <option value="Sala4">Sala 4</option>
            <option value="Sala5">Sala 5</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#333' }}>Seu Papel</label>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem', background: '#fff' }}
          >
            <option value="operator">Operator (Envia Vídeo)</option>
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
