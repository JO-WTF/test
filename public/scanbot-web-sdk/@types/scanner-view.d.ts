import React from "react";
import { ScannerConfiguration } from "./model/configuration/scanner-configuration";
import ScanbotCameraView from "./view/scanbot-camera-view";
import { CameraInfo } from "./model/camera-info";
export declare class ScanbotCameraProps {
    configuration: ScannerConfiguration;
    container?: HTMLElement;
    onSuccess?: (scanner: any) => void;
    onFailure?: (err: Error) => void;
}
export declare class ScanbotCameraState {
    videoReady: boolean;
    sdkReady: boolean;
}
export declare abstract class ScannerView<P extends ScanbotCameraProps, S extends ScanbotCameraState> extends React.Component<P, S> {
    static DEFAULT_DETECTION_RESOLUTION: number;
    static DETECTION_RESULTION_4K: number;
    protected constructor(props: P);
    camera: ScanbotCameraView | null;
    disposed?: boolean;
    get bridge(): import("./worker/worker-bridge").WorkerBridge;
    dispose(): void;
    /**
     * Internal functions
     */
    componentDidMount(): void;
    componentWillUnmount(): void;
    isSupported(): boolean;
    onVideoReady: () => void;
    onVideoError: (err: Error) => void;
    swapCameraFacing(force?: boolean): void;
    switchCamera(deviceId: string, mirrored?: boolean): Promise<void>;
    getActiveCameraInfo(): CameraInfo | undefined;
    fetchAvailableCameras(): Promise<CameraInfo[]>;
    protected renderSpinner(color: string): React.JSX.Element;
    setTorchState(enabled: boolean): Promise<void>;
}
