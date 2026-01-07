// app/api/cameras/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ICameraProps } from "@types/CameraType";

export async function GET(request: NextRequest) {
  try {
    // Add authentication check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    let signalingServer = null
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get cameras from database - only select name, url, and is_detection columns
    const { data: cameras, error } = await supabase
      .from('camera')
      .select('name, url, is_detection, encoder');
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cameras' }, 
        { status: 500 }
      );
    }

    // Get general_settings from database - only signaling_ip column
    const { data: setting, errorSetting } = await supabase
       .from('general_settings')
       .select('signaling_ip')
       .limit(1)
      

    if (errorSetting) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' }, 
        { status: 500 }
      );
    }

    signalingServer = setting[0].signaling_ip

    // Transform database response to match ICameraProps interface
    const transformedCameras: ICameraProps[] = cameras.map(camera => ({
      Name: camera.name,
      Url: camera.url,
      IsRealTimeDetection: camera.is_detection,
      SignalingServer: signalingServer
    }));

    // Filter out cameras with empty URLs or names
    const validCameras = transformedCameras.filter(camera => 
      camera.Name && 
      camera.Url && 
      camera.SignalingServer &&
      signalingServer &&
      typeof camera.IsRealTimeDetection === 'boolean'
    );

    return NextResponse.json(validCameras);

  } catch (error) {
    console.error('Error fetching cameras:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Optional: POST method to add new cameras
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    const cameraData: ICameraProps = await request.json();

    // Validate camera data
    if (!cameraData.Name || !cameraData.Url || typeof cameraData.IsRealTimeDetection !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid camera data' }, 
        { status: 400 }
      );
    }

    // Save to database - transform interface properties to database columns
    const { data, error } = await supabase
      .from('camera')
      .insert([{
        name: cameraData.Name,
        url: cameraData.Url,
        is_detection: cameraData.IsRealTimeDetection
      }])
      .select('name, url, is_detection')
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create camera' }, 
        { status: 500 }
      );
    }

    // Transform response back to interface format
    const transformedCamera: ICameraProps = {
      Name: data.name,
      Url: data.url,
      IsRealTimeDetection: data.is_detection
    };

    return NextResponse.json(transformedCamera, { status: 201 });

  } catch (error) {
    console.error('Error creating camera:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}