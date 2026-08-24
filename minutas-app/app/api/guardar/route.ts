import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { 
      titulo, 
      transcripcion, 
      audioBase64, 
      ...minutaData 
    } = await req.json();

    let audioUrl = null;

    // Si hay audio en base64, subirlo a Supabase Storage
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const fileName = `${Date.now()}-${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audios')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error subiendo audio:', uploadError);
        throw uploadError;
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('audios')
        .getPublicUrl(fileName);
      
      audioUrl = urlData.publicUrl;
    }

    // Guardar minuta en la base de datos
    const { data, error } = await supabase
      .from('minutas')
      .insert({
        titulo,
        audio_url: audioUrl,
        transcripcion,
        ...minutaData,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ exito: true, minuta: data });
  } catch (error: any) {
    console.error('Error al guardar:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
