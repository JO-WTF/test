export { IDocumentScannerHandle } from "./interfaces/i-document-scanner-handle";
export { DocumentScannerConfiguration, StyleConfiguration, TextConfiguration, CaptureButtonStyleConfiguration, OutlineStyleConfiguration, HintTextConfiguration, OutlineLabelStyleConfiguration, CaptureAnimationStyleConfiguration, OutlinePolygonStyleConfiguration } from "./model/configuration/document-scanner-configuration";
export { DocumentDetectionResult } from "./model/document/document-detection-result";
export { ContourDetectionResult } from "./model/document/contour-detection-result";
export * as DetectionStatus from "./model/document/detection-status";

export { ViewFinderScannerConfiguration } from "./model/configuration/view-finder-scanner-configuration";

export { ICroppingViewHandle } from "./interfaces/i-cropping-view-handle";
export { CroppingViewConfiguration, CroppingViewStyle, CroppingViewMagneticLineStyle, CroppingViewMagnifierStyle, CroppingViewPolygonStyle, CroppingViewMagnifierBorderStyle, CroppingViewMagnifierCrosshairStyle, CroppingViewPolygonHandleStyle } from "./model/configuration/cropping-view-configuration";
export { CroppingResult } from "./model/response/cropping-result";

export { IBarcodeScannerHandle } from "./interfaces/i-barcode-scanner-handle";
export { BarcodeScannerConfiguration } from "./model/configuration/barcode-scanner-configuration";
export { BarcodeResult } from "./model/barcode/barcode-result";
export { BarcodeFormat } from "./model/barcode/barcode-format";
export { EngineMode } from "./model/barcode/engine-mode";
export { GS1Handling } from "./model/barcode/gs1-handling";
export { BarcodeCountConfiguration, BarcodeCountStyleConfiguration } from "./model/configuration/barcode-count-configuration";

export { IMrzScannerHandle } from "./interfaces/i-mrz-scanner-handle";
export { MrzScannerConfiguration, MrzScannerAccumulatedFrameVerificationConfiguration } from "./model/configuration/mrz-scanner-configuration";
export { MrzResult, MrzCheckDigits, MrzField, MRZFieldValidationStatus } from "./model/mrz/mrz-result";
export * as SimpleMrzRecognizer from "./service/simple-mrz-recognizer";

export { TextDataScannerResult } from './model/generic-text-line-recognizer/text-data-scanner-result';
export { TextDataScannerConfiguration, TextDetectionCallback } from "./model/configuration/text-data-scanner-configuration";
export { ITextDataScannerHandle } from "./interfaces/i-text-data-scanner-handle";

export { VINScannerConfiguration } from "./model/configuration/vin-scanner-configuration";

export { OcrData, default as OcrEngine, Rect } from "./service/ocr-engine";
export { Point } from "./utils/dto/Point";
export { MagneticLine } from "./utils/dto/MagneticLine";

export { ImageProcessor, Rotation } from "./service/image-processor";
export * as ParametricFilters from "./core/compiled/ParametricFilters";

export { default as DocumentQualityAnalyzerConfiguration } from "./model/configuration/document-quality-analyzer-configuration";
export { default as DocumentQualityAnalyzer } from "./service/document-quality-analyzer";
export { default as DocumentQualityAnalyzerResult, DocumentQuality } from "./model/response/document-quality-analyzer-result";

export { default as PublicUtils } from "./service/public-utils";
export { Size } from "./utils/dto/Size";
export { VideoSize } from "./utils/dto/VideoSize";

export { SelectionOverlayConfiguration, IBarcodePolygonHandle, IBarcodePolygonLabelHandle, BarcodePolygonStyle, SelectionOverlayTextFormat, SelectionOverlayStyleConfiguration, BarcodePolygonLabelStyle } from "./model/configuration/selection-overlay-configuration";

export { default as PdfGenerator, PdfGenerationOptions, PageDirection, PageSize, PageFit } from "./service/pdf-generator";
export { default as TiffGenerator, TiffGenerationOptions } from "./service/tiff-generator";

export { BinarizationFilter, ColorFilter, ImageFilter } from "./model/filter-types";
export { Polygon } from "./utils/dto/Polygon";
export { Barcode } from "./model/barcode/barcode";

export { InitializationOptions } from "./model/configuration/initialization-options";
export { LicenseInfo } from "./model/response/license-info";
export { CameraInfo, CameraFacingMode } from "./model/camera-info";

export { default as ScanbotSDKUI2 } from "./ui2/scanbot-sdk-ui";
export * as UIConfig from "./ui2/configuration";