# 🎹 NexusMIDI Pro

**O Hub MIDI e Sintetizador Definitivo para Android e Web.**

O NexusMIDI Pro é um aplicativo profissional projetado para músicos, produtores e entusiastas. Ele transforma o seu celular ou tablet em um poderoso controlador MIDI, roteador de matriz e sintetizador SoundFont, tudo em uma interface elegante com tema "Midnight Studio".

---

## ✨ Funcionalidades Principais

*   **🎹 Teclado Virtual Avançado:** Toque acordes com suporte total a multi-touch e efeito de *glissando* (deslizar o dedo entre as notas). Conta com 9 paletas de cores para personalização.
*   **🥁 Pads de Bateria (Drum Machine):** Alterne instantaneamente entre o Piano e os Pads. São 16 pads mapeados com os instrumentos de percussão General MIDI (GM), divididos em 2 bancos.
*   **🎛️ Sintetizador SoundFont Integrado:** Carregue seus próprios arquivos `.sf2` direto do celular. O app salva o arquivo na memória do dispositivo para que você não precise reimportar toda vez. Suporta alocação **Multitimbral** (um som diferente para cada um dos 16 canais MIDI).
*   **🔀 Roteador MIDI Matrix (Patchbay):** Roteie múltiplos dispositivos de entrada para múltiplas saídas simultaneamente, com controle individual de transposição e canal por rota.
*   **📊 Controles de Estúdio (CC):** Faders verticais reais para Volume, Expressão, Modulação e Pan. Inclui uma "Roda de Pitch Bend" interativa e botão de *MIDI Panic*.
*   **📈 VU Meters:** Medidores de áudio dinâmicos nas laterais do teclado que reagem ao toque ou ao sinal MIDI externo.
*   **🔗 Conectividade Nativa:** Suporte a conexões USB (OTG) e Bluetooth LE (BLE) MIDI via API nativa do Android (Capacitor).
*   **🔍 Monitor MIDI em Tempo Real:** Visualize todas as mensagens MIDI recebidas e enviadas (Hex, Velocity, Canal).

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído com uma stack moderna focada em performance e áudio de baixa latência:

*   **Frontend:** [React](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
*   **Áudio e Síntese:** [SpessaSynth](https://github.com/spessasus/SpessaSynth) (Web Audio API)
*   **Mobile Nativo:** [Capacitor](https://capacitorjs.com/)
*   **Nativo Android:** Android MIDI API (Java)

---

## 🚀 Como Rodar o Projeto (Desenvolvimento)

### Pré-requisitos
*   [Node.js](https://nodejs.org/) (versão 18 ou superior)
*   [Android Studio](https://developer.android.com/studio) (para rodar no celular)

### Passo a Passo (Web)
1. Clone este repositório:
   ```bash
   git clone https://github.com/seu-usuario/seu-repositorio.git
   cd seu-repositorio
