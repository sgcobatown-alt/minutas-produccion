import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const titulo = formData.get('titulo') as string || 'Reunión sin título';

    if (!audioFile) {
      return NextResponse.json({ error: 'No se proporcionó audio' }, { status: 400 });
    }

    const transcriptionFormData = new FormData();
    transcriptionFormData.append('file', audioFile);
    transcriptionFormData.append('model', 'whisper-large-v3');
    transcriptionFormData.append('language', 'es');

    const transcriptionResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: transcriptionFormData,
    });

    if (!transcriptionResponse.ok) {
      throw new Error('Error en la transcripción');
    }

    const transcriptionData = await transcriptionResponse.json();
    const textoCompleto = transcriptionData.text;

    const systemPrompt = `Eres un asistente experto en secretariado ejecutivo para una planta de producción.
Analiza la transcripción y genera una minuta en JSON con esta estructura exacta:
{
  "resumen_ejecutivo": "Texto breve de 2-3 líneas",
  "temas_tratados": ["Tema 1", "Tema 2"],
  "acuerdos_decisiones": ["Acuerdo 1", "Acuerdo 2"],
  "tareas_asignadas": [
    {"responsable": "Nombre", "tarea": "Descripción", "fecha_limite": "YYYY-MM-DD o null"}
  ],
  "riesgos_bloqueos": "Problemas o riesgos mencionados",
  "participantes": ["Nombre 1", "Nombre 2"]
}`;

    const chatPayload = {
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcripción:\n\n${textoCompleto}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    };

    const chatResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatPayload),
    });

    if (!chatResponse.ok) {
      throw new Error('Error en el resumen');
    }

    const chatData = await chatResponse.json();
    const minutaJSON = JSON.parse(chatData.choices[0].message.content);

    return NextResponse.json({
      exito: true,
      titulo,
      transcripcion: textoCompleto,
      minuta: minutaJSON
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}