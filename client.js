const socket = new WebSocket('ws://webrtc-jxyz.onrender.com:3000');
let localStream;
let peerConnection;
let isCaller = true;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
//test
socket.onopen = async () => {
  console.log('✅ WebSocket connected');
  await setupLocalStream();
  createPeerConnection();

  // Delay a bit to give chance for offer to arrive first (race condition fix)
  setTimeout(async () => {
    if (isCaller) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.send(JSON.stringify({ offer }));
      console.log('📤 Offer sent');
    }
  }, 1000);
};

socket.onmessage = async (message) => {
  let data;

  if (message.data instanceof Blob) {
    const text = await message.data.text();
    data = JSON.parse(text);
  } else {
    data = JSON.parse(message.data);
  }

  console.log('📩 Message received:', data);

  if (data.offer) {
    isCaller = false; // This user is the receiver
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ answer }));
    console.log('📤 Answer sent');
  } else if (data.answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    console.log('✅ Answer set');
  } else if (data.iceCandidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.iceCandidate));
    console.log('🧊 ICE Candidate added');
  }
};

async function setupLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('🎙️ Microphone access granted');
  } catch (err) {
    console.error('❌ Microphone access error:', err);
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    console.log('📞 Remote stream received');
    const remoteAudio = new Audio();
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    remoteAudio.play().catch(err => console.error('🔇 Audio playback error:', err));
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ iceCandidate: event.candidate }));
      console.log('📤 ICE Candidate sent');
    }
  };
}
