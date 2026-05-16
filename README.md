# LiveKit Local WebRTC PoC

Esta é uma Prova de Conceito (PoC) de uma aplicação de videoconferência totalmente offline para uso em Redes Locais (LAN). O projeto utiliza **Next.js** para o Frontend/Backend e o **LiveKit Server** como motor de roteamento WebRTC.

## 🎯 Arquitetura e Funcionalidades

A aplicação foi projetada para rodar localmente sem acesso à internet, contornando o bloqueio de "Mixed Content" dos navegadores móveis por meio de um servidor HTTPS customizado com Proxy de WebSocket.

### Regras de Negócio (Papéis)
- **Operator (Operador):** Ao entrar na sala, sua **câmera traseira** é ligada automaticamente e transmitida. O Operador visualiza apenas a própria câmera na tela e não enxerga o Guide. O áudio (microfone) funciona de forma contínua em viva-voz (Full-Duplex).
- **Guide (Guia):** Entra na sala como espectador. O Guide não transmite vídeo (câmera desligada) e visualiza **apenas o vídeo dos Operadores**. O áudio (microfone) também fica ativo de forma contínua para comunicação com os operadores.

### Interface
- Design limpo e minimalista focado em dispositivos móveis (Celulares).
- Sem botões de mutar microfone ou configurações de câmera, apenas um botão vermelho de **Encerrar Chamada**.
- Bloqueio de scroll no navegador móvel (utilização de `100dvh`).

---

## 🚀 Como Executar o Projeto

Para testar o ambiente na sua máquina, você precisa abrir **dois terminais distintos**.

### Passo 1: Ligar o Servidor LiveKit (Motor WebRTC)
O servidor LiveKit (`livekit-server.exe`) já está baixado na raiz do projeto. Ele roda localmente e intermedia a troca de mídia.
Abra um terminal (PowerShell ou CMD) na raiz do projeto e execute:
```powershell
.\livekit-server.exe --dev
```
*Deixe este terminal aberto. O servidor iniciará na porta `7880`.*

### Passo 2: Ligar a Aplicação Web (Next.js)
Abra um segundo terminal na mesma pasta e inicie nossa aplicação Next.js customizada:
```powershell
npm run dev
```
*Observações do nosso script:*
1. Na primeira execução, o Next.js pode demorar de 1 a 2 minutos para compilar a aplicação por baixo dos panos.
2. O nosso servidor (`server.js`) irá **gerar certificados HTTPS auto-assinados automaticamente**.
3. O servidor abrirá a porta `3000` em HTTPS e criará um proxy invisível na rota `/livekit` redirecionando todo o tráfego do WebRTC para a porta `7880` de forma segura.

---

## 📱 Como Testar no Celular

Quando o comando `npm run dev` terminar de inicializar o servidor, ele exibirá um **QR Code no seu terminal**!

1. Conecte o seu celular na **mesma rede Wi-Fi** do computador que está rodando os servidores.
2. Abra a câmera do celular e escaneie o **QR Code** impresso no terminal.
3. O navegador será aberto num link do tipo `https://192.168.x.x:3000`.
4. **Aviso de Segurança:** Como os certificados gerados localmente não são emitidos por uma autoridade oficial, seu navegador mostrará uma tela de alerta ("Sua conexão não é particular"). 
   - Clique em **Avançado** e depois em **Ir para o site (inseguro)**.
5. Na tela inicial, selecione uma Sala, escolha seu Papel (Operator ou Guide) e clique em Entrar! 
6. Autorize o uso da Câmera e Microfone quando o navegador pedir.

Pronto! Se você fizer esse passo no celular (escolhendo Operator) e abrir no computador (escolhendo Guide), verá a comunicação fluindo perfeitamente e localmente.
