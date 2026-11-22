function deviceVoice(synthesis, language) {
  const voices = (synthesis?.getVoices() || []).filter(voice => voice.localService === true);
  const sameLanguage = voice => voice.lang.toLowerCase().split('-')[0] === language.split('-')[0];
  return voices.find(voice => voice.lang.toLowerCase() === language) || voices.find(sameLanguage) ||
    voices.find(voice => voice.default) || voices[0];
}

export function createBlipSpeech(onChange, onError) {
  const synthesis = typeof globalThis.SpeechSynthesisUtterance === 'function' ? globalThis.speechSynthesis : null;
  const language = globalThis.navigator?.language?.toLowerCase() || 'en';
  let voice = deviceVoice(synthesis, language);
  let reading;

  function updateVoices() {
    voice = deviceVoice(synthesis, language);
    if (!voice && reading) stop();
    else onChange();
  }

  function stop() {
    if (!reading) return;
    reading = undefined;
    synthesis.cancel();
    onChange();
  }

  function failed(request) {
    if (reading !== request) return;
    stop();
    onError('The device voice could not read this reply.');
  }

  function play(request) {
    if (reading !== request) return;
    const chunk = request.chunks[request.next++];
    if (!chunk) {
      reading = undefined;
      onChange();
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.voice = request.voice;
      utterance.lang = request.voice.lang;
      utterance.onend = () => play(request);
      utterance.onerror = () => failed(request);
      synthesis.speak(utterance);
    } catch {
      failed(request);
    }
  }

  synthesis?.addEventListener('voiceschanged', updateVoices);
  return {
    available: () => Boolean(voice),
    readingId: () => reading?.id,
    toggle(id, text) {
      const same = reading?.id === id;
      stop();
      if (same || !voice) return;
      const plain = text.trim().replace(/\s+/g, ' ');
      const chunks = plain.match(/.{1,200}(?:\s|$)|.{1,200}/gu) || [];
      if (!chunks.length) {
        onError('This reply has no text to read.');
        return;
      }
      const request = { id, chunks, voice, next: 0 };
      reading = request;
      onChange();
      play(request);
    },
    stop,
    dispose() {
      synthesis?.removeEventListener('voiceschanged', updateVoices);
      stop();
    },
  };
}
