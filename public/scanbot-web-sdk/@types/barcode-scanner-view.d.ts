import React from "react";
import { ScanbotCameraProps, ScanbotCameraState, ScannerView } from "./scanner-view";
import { IBarcodeScannerHandle } from "./interfaces/i-barcode-scanner-handle";
import ViewFinder, { ViewFinderPadding } from "./view/view-finder";
import { ShutterButtonAction } from "./view/shutter-button";
import BarcodeCalculationPopup from "./view/barcode-calculation/barcode-calculation-popup";
import AnimatedBarcodeSelectionOverlay from "./view/barcode-polygon/animated-barcode-selection-overlay";
import BottomActionBar from "./view/action-bar/bottom-action-bar";
import ScannedImageWithOverlay from "./view/barcode-calculation/scanned-image-with-overlay";
import { BarcodeScannerConfiguration } from "./model/configuration/barcode-scanner-configuration";
import { BarcodeResult } from "./model/barcode/barcode-result";
import { ImageDataWrapper } from "./model/image-data-wrapper";
import { Barcode } from "./model/barcode/barcode";
import { Size } from "./utils/dto/Size";
export declare class BarcodeScannerProps extends ScanbotCameraProps {
    viewFinderPadding?: ViewFinderPadding;
    /**
     * The user should check that the license is valid before using the BarcodeScannerView.
     * In case the license expires while the scanner is open, `onLicenseError` will be called.
     */
    onLicenseError?: () => void;
}
export declare class BarcodeScannerState extends ScanbotCameraState {
    isFinderVisible?: boolean;
    zoom?: number;
    action: ShutterButtonAction;
    image?: string;
    bottomHintText?: string;
}
export default class BarcodeScannerView extends ScannerView<BarcodeScannerProps, BarcodeScannerState> implements IBarcodeScannerHandle {
    finder?: ViewFinder;
    shouldComputeSize: boolean;
    private _configuration;
    private paused;
    recognition: {
        imageData: ImageDataWrapper;
        originalImage: any;
        barcodeResult: BarcodeResult;
    };
    overlay?: AnimatedBarcodeSelectionOverlay | undefined;
    popup: BarcodeCalculationPopup | undefined;
    scannedImage: ScannedImageWithOverlay | undefined;
    bottomActionBar: BottomActionBar | undefined;
    readonly barcodes: Barcode[];
    private detectionRunning;
    constructor(props: BarcodeScannerProps);
    get configuration(): BarcodeScannerConfiguration;
    get enabled(): boolean;
    /**
     * Public API functions
     */
    static create(configuration: BarcodeScannerConfiguration): Promise<BarcodeScannerView>;
    isDetectionPaused(): boolean;
    resumeDetection(): Promise<void>;
    pauseDetection(): void;
    private readonly updateDimensionsCallback;
    /**
     * React Overrides
     */
    componentDidMount(): Promise<void>;
    componentWillUnmount(): void;
    updateDimensions(): Promise<void>;
    resume(): Promise<void>;
    pause(): void;
    detect(): Promise<void>;
    backendurl: string | undefined;
    setUseBackendService(url: string | undefined): void;
    private recognizeBarcodes;
    desiredRecognitionResolution: number | undefined;
    setRecognitionResolution(resolution: number): void;
    getResolution(): Promise<Size>;
    saveExtractedImageData(): void;
    setFinderVisible(isVisible: boolean): void;
    setZoom(zoom: number): void;
    setCameraDirection(direction: "environment" | "user"): void;
    updateTorch(enabled: boolean): void;
    getCapabilities(): MediaTrackCapabilities | undefined;
    render(): React.JSX.Element;
    resetCountImage(): void;
    countLabelText(barcodes: Barcode[]): string;
}
