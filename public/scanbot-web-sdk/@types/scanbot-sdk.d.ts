import { WorkerBridge } from "./worker/worker-bridge";
import { InitializationOptions } from "./model/configuration/initialization-options";
import { DocumentScannerConfiguration } from "./model/configuration/document-scanner-configuration";
import { BarcodeScannerConfiguration } from "./model/configuration/barcode-scanner-configuration";
import { CroppingViewConfiguration } from "./model/configuration/cropping-view-configuration";
import { ImageFilter } from './model/filter-types';
import { LicenseInfo } from "./model/response/license-info";
import { IDocumentScannerHandle } from "./interfaces/i-document-scanner-handle";
import { IBarcodeScannerHandle } from "./interfaces/i-barcode-scanner-handle";
import { ICroppingViewHandle } from "./interfaces/i-cropping-view-handle";
import PdfGenerator, { PdfGenerationOptions } from './service/pdf-generator';
import TiffGenerator, { TiffGenerationOptions } from './service/tiff-generator';
import PublicUtils from "./service/public-utils";
import { Polygon } from "./utils/dto/Polygon";
import { BarcodeResult } from "./model/barcode/barcode-result";
import { EngineMode } from "./model/barcode/engine-mode";
import { BarcodeFormat } from "./model/barcode/barcode-format";
import { MrzScannerConfiguration } from "./model/configuration/mrz-scanner-configuration";
import { IMrzScannerHandle } from "./interfaces/i-mrz-scanner-handle";
import SimpleMrzRecognizer from "./service/simple-mrz-recognizer";
import OcrEngine from "./service/ocr-engine";
import { ContourDetectionResult } from "./model/document/contour-detection-result";
import { TextDataScannerConfiguration } from "./model/configuration/text-data-scanner-configuration";
import { VINScannerConfiguration } from "./model/configuration/vin-scanner-configuration";
import { ITextDataScannerHandle } from "./interfaces/i-text-data-scanner-handle";
import DocumentQualityAnalyzerConfiguration from "./model/configuration/document-quality-analyzer-configuration";
import DocumentQualityAnalyzer from "./service/document-quality-analyzer";
import { ImageProcessor } from "./service/image-processor";
import * as imageFilters from "./core/compiled/ParametricFilters";
import ScanbotSDKUI from "./ui2/scanbot-sdk-ui";
import { GS1Handling } from "./model/barcode/gs1-handling";
export default class ScanbotSDK {
    /** @internal */
    bridge: WorkerBridge;
    private initialized;
    private static defaultEnginePath;
    /** @internal */
    static instance: ScanbotSDK;
    private static _ui2;
    static get UI(): typeof ScanbotSDKUI;
    static initialize(options: InitializationOptions): Promise<ScanbotSDK>;
    /**
     * View Components
     */
    createDocumentScanner(configuration: DocumentScannerConfiguration): Promise<IDocumentScannerHandle>;
    createMrzScanner(configuration: MrzScannerConfiguration): Promise<IMrzScannerHandle>;
    createBarcodeScanner(configuration: BarcodeScannerConfiguration): Promise<IBarcodeScannerHandle>;
    openCroppingView(configuration: CroppingViewConfiguration): Promise<ICroppingViewHandle>;
    createTextDataScanner(configuration: TextDataScannerConfiguration): Promise<ITextDataScannerHandle>;
    createVINScanner(configuration: VINScannerConfiguration): Promise<ITextDataScannerHandle>;
    /**
     * Image Operations
     */
    toDataUrl(imageBuffer: ArrayBuffer): Promise<string>;
    /**
     * @deprecated Use the new ImageProcessor API instead (see {@link createImageProcessor}).
     */
    applyFilter(imageBuffer: ArrayBuffer, filterType: ImageFilter): Promise<ArrayBuffer>;
    rotateImageCcw(imageBuffer: ArrayBuffer, rotations: number): Promise<ArrayBuffer>;
    cropAndRotateImageCcw(imageBuffer: ArrayBuffer, polygon: Polygon, rotations: number): Promise<any>;
    detectDocument(imageBuffer: ArrayBuffer, acceptedAngleScore?: number, acceptedSizeScore?: number, acceptedBrightnessThreshold?: number): Promise<ContourDetectionResult>;
    detectAndCropDocument(imageBuffer: ArrayBuffer): Promise<ContourDetectionResult>;
    detectBarcodes(base64: string, engineMode?: EngineMode, barcodeFormats?: BarcodeFormat[], returnBarcodeImage?: boolean, gs1Handling?: GS1Handling): Promise<BarcodeResult>;
    createSimpleMRZRecognizer(): Promise<SimpleMrzRecognizer>;
    createOcrEngine(options?: {
        mode: string;
    }): Promise<OcrEngine>;
    createDocumentQualityAnalyzer(config?: DocumentQualityAnalyzerConfiguration): Promise<DocumentQualityAnalyzer>;
    createImageProcessor(imageBuffer: ArrayBuffer): Promise<ImageProcessor>;
    /**
     * Misc. Features
     */
    getLicenseInfo(): Promise<LicenseInfo>;
    beginPdf(options?: PdfGenerationOptions): Promise<PdfGenerator>;
    beginTiff(options?: TiffGenerationOptions): Promise<TiffGenerator>;
    get version(): string;
    private _utils;
    get utils(): PublicUtils;
    release(object: any, source?: string): Promise<void>;
    private licenseCheck;
    private createGenericTextLineScanner;
    static imageFilters: {
        ScanbotBinarizationFilter: typeof imageFilters.ScanbotBinarizationFilter;
        CustomBinarizationFilter: typeof imageFilters.CustomBinarizationFilter;
        ColorDocumentFilter: typeof imageFilters.ColorDocumentFilter;
        BrightnessFilter: typeof imageFilters.BrightnessFilter;
        ContrastFilter: typeof imageFilters.ContrastFilter;
        GrayscaleFilter: typeof imageFilters.GrayscaleFilter;
        LegacyFilter: typeof imageFilters.LegacyFilter;
        WhiteBlackPointFilter: typeof imageFilters.WhiteBlackPointFilter;
    };
}
