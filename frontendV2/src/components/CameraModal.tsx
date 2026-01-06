
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Modal from './common/Modal';
import Button from './common/Button';

interface CameraModalProps {
  onClose: () => void;
  onPhotoTaken: (dataUrl: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onClose, onPhotoTaken }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Chyba při přístupu k fotoaparátu: ", err);
      alert("Nepodařilo se získat přístup k fotoaparátu. Ujistěte se, že jste povolili přístup v nastavení prohlížeče.");
      onClose();
    }
  }, [onClose]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhotoDataUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const handleConfirm = () => {
    if(photoDataUrl) {
      onPhotoTaken(photoDataUrl);
    }
  };
  
  const handleRetake = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  return (
    <Modal title="Vyfotit dokumentaci" onClose={onClose}>
      <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
        {photoDataUrl ? (
          <img src={photoDataUrl} alt="Captured preview" className="w-full h-full object-contain" />
        ) : (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
        )}
        <canvas ref={canvasRef} className="hidden"></canvas>
      </div>
      <div className="flex justify-center mt-4 space-x-4">
        {photoDataUrl ? (
          <>
            <Button onClick={handleRetake} variant="secondary">Znovu</Button>
            <Button onClick={handleConfirm}>Potvrdit</Button>
          </>
        ) : (
          <Button onClick={takePicture} className="w-16 h-16 rounded-full !p-0 flex items-center justify-center">
             <i className="fas fa-camera text-2xl"></i>
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default CameraModal;
