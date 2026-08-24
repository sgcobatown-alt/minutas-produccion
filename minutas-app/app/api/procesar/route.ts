import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 });
    }

    console.log('1. Iniciando transcripción...');
    const transcriptionFormData = new FormData();
    transcriptionFormData.append('file', audioFile);
    transcriptionFormData.append('model', 'whisper-large-v3');
    transcriptionFormData.append('language', 'es');

    const resTrans = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: transcriptionFormData,
    });

    if (!resTrans.ok) {
      const err = await resTrans.text();
      console.error('ERROR TRANSCRIPCIÓN:', err);
      return NextResponse.json({ error: 'Falló la transcripción: ' + err }, { status: 500 });
    }

    const dataTrans = await resTrans.json();
    const texto = dataTrans.text;
    console.log('2. Transcripción exitosa. Longitud:', texto.length);

    console.log('3. Solicitando resumen a IA (Modelo GPT OSS 120B)...');
    const resChat = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // <-- MODELO MÁS ESTABLE
        messages: [
          { 
            role: 'system', 
            content: `Eres un asistente que genera minutas de reuniones. Responde EXCLUSIVAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "resumen_ejecutivo": "string con resumen de 2-3 líneas",
  "temas_tratados": ["tema 1", "tema 2"],
  "acuerdos_decisiones": ["acuerdo 1", "acuerdo 2"],
  "tareas_asignadas": [{"responsable": "nombre", "tarea": "descripción", "fecha_limite": "YYYY-MM-DD o null"}],
  "riesgos_bloqueos": "string con riesgos mencionados",
  "participantes": ["nombre 1", "nombre 2"]
}` 
          },
          { role: 'user', content: 'Transcripción de la reunión:\n\n' + texto }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      }),
    });

    if (!resChat.ok) {
      const err = await resChat.text();
      console.error('ERROR RESUMEN:', err);
      return NextResponse.json({ error: 'Falló el resumen: ' + err }, { status: 500 });
    }

    const chatData = await resChat.json();
    
    if (!chatData.choices || !chatData.choices[0]) {
      console.error('Respuesta inesperada de Groq:', chatData);
      return NextResponse.json({ error: 'La IA devolvió una respuesta vacía' }, { status: 500 });
    }

    const minuta = JSON.parse(chatData.choices[0].message.content);

    console.log('4. ¡Proceso completado con éxito!');
    return NextResponse.json({ exito: true, transcripcion: texto, minuta });

  } catch (error: any) {
    console.error('ERROR CRÍTICO:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
