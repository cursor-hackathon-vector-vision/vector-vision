/**
 * Video Recorder utility for capturing Three.js canvas
 */

export class VideoRecorder {
  private canvas: HTMLCanvasElement;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private onStatusChange: ((recording: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public setStatusCallback(callback: (recording: boolean) => void): void {
    this.onStatusChange = callback;
  }

  public startRecording(options?: { 
    mimeType?: string; 
    videoBitsPerSecond?: number;
  }): boolean {
    if (this.isRecording) {
      console.warn('Already recording');
      return false;
    }

    try {
      // Get canvas stream
      const stream = this.canvas.captureStream(60); // 60 FPS
      
      // Check supported mime types
      const mimeType = this.getSupportedMimeType(options?.mimeType);
      
      if (!mimeType) {
        console.error('No supported video format found');
        return false;
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: options?.videoBitsPerSecond || 8000000 // 8 Mbps
      });

      this.recordedChunks = [];

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Handle stop
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.onStatusChange?.(false);
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.onStatusChange?.(true);

      console.log(`Recording started with ${mimeType}`);
      return true;

    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  public stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        console.warn('Not recording');
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.onStatusChange?.(false);
        
        // Create final blob
        const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        
        console.log(`Recording stopped. Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public async stopAndDownload(filename: string = 'vector-vision-recording'): Promise<void> {
    const blob = await this.stopRecording();
    
    if (!blob) {
      console.error('No recording to download');
      return;
    }

    // Determine file extension from mime type
    const extension = blob.type.includes('webm') ? 'webm' : 'mp4';
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Downloaded: ${filename}.${extension}`);
  }

  public getRecordingStatus(): boolean {
    return this.isRecording;
  }

  public getRecordedBlob(): Blob | null {
    if (this.recordedChunks.length === 0) return null;
    
    const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
    return new Blob(this.recordedChunks, { type: mimeType });
  }

  private getSupportedMimeType(preferred?: string): string | null {
    const mimeTypes = [
      preferred,
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ].filter(Boolean) as string[];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return null;
  }

  public dispose(): void {
    if (this.isRecording) {
      this.mediaRecorder?.stop();
    }
    this.recordedChunks = [];
    this.mediaRecorder = null;
  }
}

/**
 * Camera Path for cinematic recordings
 */
export interface CameraKeyframe {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  time: number; // Timestamp in ms
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export class CameraPath {
  private keyframes: CameraKeyframe[] = [];
  private duration: number = 0;

  public addKeyframe(keyframe: CameraKeyframe): void {
    this.keyframes.push(keyframe);
    this.keyframes.sort((a, b) => a.time - b.time);
    this.duration = Math.max(this.duration, keyframe.time);
  }

  public clearKeyframes(): void {
    this.keyframes = [];
    this.duration = 0;
  }

  public getPositionAtTime(time: number): { 
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null {
    if (this.keyframes.length === 0) return null;
    if (this.keyframes.length === 1) {
      return {
        position: this.keyframes[0].position,
        target: this.keyframes[0].target
      };
    }

    // Find surrounding keyframes
    let prevFrame = this.keyframes[0];
    let nextFrame = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (time >= this.keyframes[i].time && time <= this.keyframes[i + 1].time) {
        prevFrame = this.keyframes[i];
        nextFrame = this.keyframes[i + 1];
        break;
      }
    }

    // Calculate interpolation factor
    const duration = nextFrame.time - prevFrame.time;
    const elapsed = time - prevFrame.time;
    let t = duration > 0 ? elapsed / duration : 0;

    // Apply easing
    t = this.applyEasing(t, nextFrame.easing || 'ease-in-out');

    // Interpolate position and target
    return {
      position: {
        x: prevFrame.position.x + (nextFrame.position.x - prevFrame.position.x) * t,
        y: prevFrame.position.y + (nextFrame.position.y - prevFrame.position.y) * t,
        z: prevFrame.position.z + (nextFrame.position.z - prevFrame.position.z) * t
      },
      target: {
        x: prevFrame.target.x + (nextFrame.target.x - prevFrame.target.x) * t,
        y: prevFrame.target.y + (nextFrame.target.y - prevFrame.target.y) * t,
        z: prevFrame.target.z + (nextFrame.target.z - prevFrame.target.z) * t
      }
    };
  }

  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - (1 - t) * (1 - t);
      case 'ease-in-out':
        return t < 0.5 
          ? 2 * t * t 
          : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t;
    }
  }

  public getDuration(): number {
    return this.duration;
  }

  public getKeyframes(): CameraKeyframe[] {
    return [...this.keyframes];
  }

  /**
   * Generate a default cinematic path around the scene
   */
  public static createOrbitPath(
    centerX: number = 0, 
    centerZ: number = 0,
    radius: number = 25,
    height: number = 15,
    duration: number = 10000
  ): CameraPath {
    const path = new CameraPath();
    const steps = 8;

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const time = (i / steps) * duration;
      
      path.addKeyframe({
        position: {
          x: centerX + Math.cos(angle) * radius,
          y: height + Math.sin(i * 0.5) * 3,
          z: centerZ + Math.sin(angle) * radius
        },
        target: { x: centerX, y: 2, z: centerZ },
        time,
        easing: 'ease-in-out'
      });
    }

    return path;
  }

  /**
   * Generate a zoom-in flyover path
   */
  public static createFlyoverPath(
    startHeight: number = 40,
    endHeight: number = 8,
    duration: number = 8000
  ): CameraPath {
    const path = new CameraPath();

    path.addKeyframe({
      position: { x: 30, y: startHeight, z: 30 },
      target: { x: 0, y: 0, z: 0 },
      time: 0,
      easing: 'ease-out'
    });

    path.addKeyframe({
      position: { x: 15, y: startHeight * 0.6, z: 15 },
      target: { x: 0, y: 2, z: 0 },
      time: duration * 0.4,
      easing: 'ease-in-out'
    });

    path.addKeyframe({
      position: { x: 8, y: endHeight, z: 8 },
      target: { x: 0, y: 3, z: 0 },
      time: duration,
      easing: 'ease-in'
    });

    return path;
  }
}
