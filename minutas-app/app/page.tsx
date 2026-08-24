'use client';
import { useState, useRef, useEffect } from 'react';
import { 
  Mic, Square, Loader2, Download, FileText, CheckCircle, 
  Users, AlertTriangle, Calendar, Play, Pause, Save,
  History, Trash2
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import toast, { Toaster } from 'react-hot-toast';

export default function Home() {
  const [grabando, setGrabando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [transcripcion, setTranscripcion] = useState('');
  const [minuta, setMinuta] = useState<any>(null);
  const [titulo, setTitulo] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [minutasGuardadas, setMinutasGuardadas] = useState<any[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervaloRef = useRef<NodeJS.Timeout | null>(null);
  const inicioRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      chunksRef.current = [];
      inicioRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        await procesarAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setGrabando(true);

      intervaloRef.current = setInterval(() => {
        setTiempo(Math.floor((Date.now() - inicioRef.current) / 1000));
      }, 1000);
      
      toast.success('🎙️ Grabando...');
    } catch (err) {
      toast.error('Error al acceder al micrófono');
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop();
      setGrabando(false);
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    }
  };

  const procesarAudio = async (audioBlob: Blob) => {
    setProcesando(true);
    setTranscripcion('');
    setMinuta(null);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'reunion.webm');
    formData.append('titulo', titulo || `Reunión ${new Date().toLocaleDateString('es-ES')}`);

    try {
      const res = await fetch('/api/procesar', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.exito) {
        setTranscripcion(data.transcripcion);
        setMinuta(data.minuta);
        toast.success('✅ Minuta generada con éxito');
      } else {
        toast.error('Error: ' + (data.error || 'Desconocido'));
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setProcesando(false);
    }
  };

  const guardarMinuta = async () => {
    if (!minuta || !audioBlob) {
      toast.error('No hay minuta o audio para guardar');
      return;
    }
    
    try {
      // Convertir audio a base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];
        
        const res = await fetch('/api/guardar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: titulo || `Reunión ${new Date().toLocaleDateString('es-ES')}`,
            transcripcion,
            audioBase64: base64Data,
            resumen_ejecutivo: minuta.resumen_ejecutivo,
            temas_tratados: minuta.temas_tratados,
            acuerdos_decisiones: minuta.acuerdos_decisiones,
            tareas_asignadas: minuta.tareas_asignadas,
            riesgos_bloqueos: minuta.riesgos_bloqueos,
            participantes: minuta.participantes,
            duracion_segundos: tiempo,
          }),
        });
        
        const data = await res.json();
        
        if (data.exito) {
          toast.success(' Minuta y audio guardados');
          cargarHistorial();
        } else {
          toast.error('Error al guardar: ' + data.error);
        }
      };
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const descargarAudio = () => {
    if (!audioBlob) {
      toast.error('No hay audio disponible');
      return;
    }
    
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audio-${titulo?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'reunion'}-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('🎵 Audio descargado');
  };

  const reproducirAudio = () => {
    if (!audioUrl) return;
    
    if (audioRef.current) {
      if (reproduciendo) {
        audioRef.current.pause();
        setReproduciendo(false);
      } else {
        audioRef.current.play();
        setReproduciendo(true);
      }
    }
  };

  const exportarPDF = () => {
    if (!minuta) return;
    const doc = new jsPDF();
    let y = 20;
    
    // Header estilo InMetal
    doc.setFillColor(184, 45, 45); // Rojo industrial
    doc.rect(0, 0, 210, 30, 'F');
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(minuta.titulo || 'Minuta de Reunión', 105, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 105, 26, { align: 'center' });
    
    y = 40;
    doc.setTextColor(50, 50, 50);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Ejecutivo', 20, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(minuta.resumen_ejecutivo || '', 170);
    doc.text(lines, 20, y);
    y += lines.length * 6 + 10;

    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Acuerdos y Decisiones', 20, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    minuta.acuerdos_decisiones?.forEach((a: string, i: number) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${i + 1}. ${a}`, 25, y);
      y += 7;
    });

    doc.save(`minuta-${Date.now()}.pdf`);
    toast.success(' PDF descargado');
  };

  const exportarWord = async () => {
    if (!minuta) return;
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: minuta.titulo || 'Minuta de Reunión',
            heading: HeadingLevel.HEADING_1,
            alignment: 'center',
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'Resumen Ejecutivo',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({ children: [new TextRun(minuta.resumen_ejecutivo || '')] }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'Acuerdos y Decisiones',
            heading: HeadingLevel.HEADING_2,
          }),
          ...minuta.acuerdos_decisiones?.map((a: string, i: number) => 
            new Paragraph({ children: [new TextRun(`${i + 1}. ${a}`)] })
          ) || [],
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `minuta-${Date.now()}.docx`);
    toast.success('📄 Word descargado');
  };

  const cargarHistorial = async () => {
    try {
      const res = await fetch('/api/minutas');
      const data = await res.json();
      if (data.exito) {
        setMinutasGuardadas(data.minutas);
        setMostrarHistorial(true);
      }
    } catch (error) {
      toast.error('Error al cargar historial');
    }
  };

  const formatearTiempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      <Toaster position="top-right" />
      
      {/* Header estilo InMetal */}
      <header className="bg-gradient-to-r from-red-800 via-red-700 to-red-800 shadow-2xl border-b-4 border-gray-400">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                In<span className="text-gray-300">Metal</span>
              </h1>
              <p className="text-red-200 text-sm mt-1 font-medium">
                INDUSTRIA METALÚRGICA - Sistema de Minutas Inteligentes
              </p>
            </div>
            
            <button
              onClick={cargarHistorial}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-semibold transition-all border-2 border-white/30"
            >
              <History className="w-5 h-5" />
              Historial
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Input de título */}
        <div className="mb-8">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Nombre de la reunión (ej: Reunión Producción Semanal)"
            className="w-full px-6 py-4 bg-white/5 border-2 border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-lg"
          />
        </div>

        {/* Grabadora */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl p-8 mb-8 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Grabadora de Audio</h2>
              <p className="text-gray-400 text-sm">Graba reuniones y genera minutas automáticamente</p>
            </div>
            {grabando && (
              <div className="flex items-center gap-3 bg-red-600/20 border-2 border-red-500 px-4 py-2 rounded-full">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-mono text-xl font-bold text-red-400">{formatearTiempo(tiempo)}</span>
              </div>
            )}
          </div>

          {!grabando ? (
            <button
              onClick={iniciarGrabacion}
              disabled={procesando}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-8 py-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
            >
              <Mic className="w-6 h-6" />
              Iniciar Grabación
            </button>
          ) : (
            <button
              onClick={detenerGrabacion}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white px-8 py-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 animate-pulse shadow-xl border-2 border-gray-600"
            >
              <Square className="w-6 h-6" />
              Detener y Procesar
            </button>
          )}

          {procesando && (
            <div className="mt-6 bg-blue-900/30 border-2 border-blue-500/50 p-6 rounded-xl flex items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <div>
                <p className="text-blue-300 font-semibold text-lg">Procesando con IA...</p>
                <p className="text-blue-400/70 text-sm">Transcribiendo y analizando la reunión</p>
              </div>
            </div>
          )}
        </div>

        {/* Resultados */}
        {minuta && (
          <>
            {/* Controles */}
            <div className="flex flex-wrap gap-4 mb-8">
              <button
                onClick={guardarMinuta}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
              >
                <Save className="w-5 h-5" />
                Guardar Minuta
              </button>
              <button
                onClick={descargarAudio}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
              >
                <Download className="w-5 h-5" />
                Descargar Audio
              </button>
              <button
                onClick={exportarPDF}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
              >
                <FileText className="w-5 h-5" />
                PDF
              </button>
              <button
                onClick={exportarWord}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
              >
                <FileText className="w-5 h-5" />
                Word
              </button>
            </div>

            {/* Reproductor de audio */}
            {audioUrl && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-xl p-6 mb-8 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-red-400" />
                  Audio de la Reunión
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={reproducirAudio}
                    className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full transition-colors"
                  >
                    {reproduciendo ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  <div className="flex-1">
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setReproduciendo(false)}
                      className="w-full"
                      controls
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Minuta estructurada */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-xl border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-red-400" />
                    <h3 className="font-bold text-lg text-white">Resumen Ejecutivo</h3>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{minuta.resumen_ejecutivo}</p>
                </div>

                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-xl border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <h3 className="font-bold text-lg text-white">Acuerdos</h3>
                  </div>
                  <ul className="space-y-2">
                    {minuta.acuerdos_decisiones?.map((acuerdo: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-green-400 font-bold">✓</span>
                        <span className="text-sm">{acuerdo}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-xl border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-lg text-white">Tareas</h3>
                  </div>
                  <div className="space-y-3">
                    {minuta.tareas_asignadas?.map((tarea: any, i: number) => (
                      <div key={i} className="bg-gray-700/50 p-3 rounded-lg border-l-4 border-purple-500">
                        <p className="font-semibold text-sm text-white">{tarea.tarea}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {tarea.responsable}
                          </span>
                          {tarea.fecha_limite && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {tarea.fecha_limite}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {minuta.riesgos_bloqueos && (
                  <div className="bg-yellow-900/30 p-6 rounded-xl shadow-xl border border-yellow-600/50">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      <h3 className="font-bold text-lg text-yellow-300">Riesgos</h3>
                    </div>
                    <p className="text-yellow-200/80 text-sm leading-relaxed">{minuta.riesgos_bloqueos}</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-xl border border-gray-700 h-full">
                  <h3 className="font-bold text-xl mb-4 text-white">📜 Transcripción Completa</h3>
                  <div className="bg-gray-950/50 p-4 rounded-lg h-[600px] overflow-y-auto border border-gray-700">
                    <p className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                      {transcripcion}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Historial */}
      {mostrarHistorial && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <History className="w-6 h-6 text-red-400" />
                Historial de Minutas
              </h3>
              <button 
                onClick={() => setMostrarHistorial(false)}
                className="text-gray-400 hover:text-white"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {minutasGuardadas.map((minutaGuardada: any) => (
                <div key={minutaGuardada.id} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <h4 className="font-bold text-white text-lg">{minutaGuardada.titulo}</h4>
                  <p className="text-gray-400 text-sm mt-1">
                    {new Date(minutaGuardada.fecha_reunion).toLocaleDateString('es-ES')}
                  </p>
                  {minutaGuardada.audio_url && (
                    <a
                      href={minutaGuardada.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 mt-2 text-sm"
                    >
                      <Play className="w-4 h-4" />
                      Reproducir Audio
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
