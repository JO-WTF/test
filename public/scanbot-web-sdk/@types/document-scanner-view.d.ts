import React from "react";
import { DocumentScannerConfiguration } from "./model/configuration/document-scanner-configuration";
import { DocumentDetectionResult } from "./model/document/document-detection-result";
import { ScanbotCameraProps, ScanbotCameraState, ScannerView } from "./scanner-view";
import { ShutterButton, ShutterButtonAction } from "./view/shutter-button";
import { DocumentOutline } from "./view/document-outline";
import { PolygonMovementPredicate } from "./utils/predicate/polygon-movement-predicate";
import { Polygon } from "./utils/dto/Polygon";
import { IDocumentScannerHandle } from "./interfaces/i-document-scanner-handle";
export declare class DocumentScannerState extends ScanbotCameraState {
    action: ShutterButtonAction;
}
export declare class DocumentScannerProps extends ScanbotCameraProps {
}
export default class DocumentScannerView extends ScannerView<DocumentScannerProps, DocumentScannerState> implements IDocumentScannerHandle {
    static DETECT_AND_CROP_RESOLUTION: number;
    outline: DocumentOutline | null;
    button: ShutterButton | null;
    polygonMovementPredicate: PolygonMovementPredicate;
    autoCaptureToken: any;
    private _configuration?;
    constructor(props: DocumentScannerProps);
    get defaultAction(): ShutterButtonAction;
    get enabled(): boolean;
    get configuration(): DocumentScannerConfiguration;
    get autoCaptureSensitivity(): number;
    /**
     * Public API functions
     */
    static create(configuration: DocumentScannerConfiguration): Promise<DocumentScannerView>;
    detectAndCrop(): Promise<DocumentDetectionResult>;
    enableAutoCapture(): void;
    disableAutoCapture(): void;
    updateAutoCapture(enabled: boolean): void;
    isAutoCaptureEnabled(): boolean;
    recognizer: any;
    /**
     * Internal functions
     */
    componentDidMount(): Promise<void>;
    componentWillUnmount(): Promise<void>;
    detect(): Promise<void>;
    getStatusString(detectionResult: any): string;
    detectInWebWorker(): Promise<any>;
    preventAutoCapture?: boolean;
    handleAutoCapture(statusOk: boolean, polygon?: Polygon): Promise<void>;
    updateButton(action: ShutterButtonAction): void;
    render(): React.JSX.Element;
    defaultCaptureButtonClick: () => Promise<void>;
    private scalePolygonPointsToPixels;
    private runMovementPredicate;
    private getCameraFrameSize;
}
