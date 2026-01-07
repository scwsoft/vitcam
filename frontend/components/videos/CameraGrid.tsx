import VideoPlayer from '@/components/VideoPlayer';
import { ICameraProps } from '@/types/CameraType';

interface CameraGridProps {
  cameras: ICameraProps[];
}

export default function CameraGrid({ cameras }: CameraGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {cameras.map((camera, index) => (
        <VideoPlayer
          key={`camera-${camera.Name}-${index}`}
          id={index + 1}
          Name={camera.Name}
          Url={camera.Url}
          IsRealTimeDetection={camera.IsRealTimeDetection}
          ServerName={camera.SignalingServer}
        />
      ))}
    </div>
  );
}