import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { roomName, participantName } = await req.json();

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'roomName and participantName are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("Faltam chaves de API do LiveKit no arquivo .env.local");
      return NextResponse.json(
        { error: 'Servidor mal configurado. Faltam as chaves do LiveKit.' },
        { status: 500 }
      );
    }

    // Instancia o AccessToken com as chaves lidas
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });

    // Concede permissões para entrar na sala especificada
    at.addGrant({ roomJoin: true, room: roomName });

    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
