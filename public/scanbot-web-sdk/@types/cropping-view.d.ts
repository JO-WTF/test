import React from "react";
import { CroppingViewConfiguration } from "./model/configuration/cropping-view-configuration";
import { DraggableDocumentPolygon } from "./view/polygon/draggable-document-polygon";
import { Animatable } from "./view/utils/animatable";
import { CroppingResult } from "./model/response/cropping-result";
import { Size } from "./utils/dto/Size";
import { Point } from "./utils/dto/Point";
import { MagneticLine } from "./utils/dto/MagneticLine";
import { Polygon } from "./utils/dto/Polygon";
import MagnifierView, { MagnifierOptions } from "./view/cropping/magnifier-view";
import { ICroppingViewHandle } from "./interfaces/i-cropping-view-handle";
export interface CroppingViewProps {
    configuration: CroppingViewConfiguration;
    container?: HTMLElement;
    style?: {
        polygon: {};
    };
    onReady?: (view: any) => void;
    onError?: (err: Error) => void;
}
export interface CroppingViewState {
    image: string;
    polygon: Polygon;
    calculatedSize: Size;
    animation: {
        rotations: number;
        scale: number;
        duration: number;
    };
    points: Point[];
    magneticLines: {
        horizontal: {
            original: MagneticLine[];
            scaled?: MagneticLine[];
        };
        vertical: {
            original: MagneticLine[];
            scaled?: MagneticLine[];
        };
    };
    imageMargin: Point;
}
export default class CroppingView extends React.Component<CroppingViewProps, CroppingViewState> implements ICroppingViewHandle {
    polygon: DraggableDocumentPolygon | null;
    container: Animatable;
    htmlImage: HTMLImageElement;
    private _configuration?;
    private onResizeCallback;
    constructor(props: any);
    /**
     * Public API functions
     */
    static create(configuration: CroppingViewConfiguration): Promise<CroppingView>;
    componentDidMount(): Promise<void>;
    componentWillUnmount(): Promise<void>;
    onImageLoaded(image: HTMLImageElement): Promise<void>;
    onResize(): void;
    initializeSizes(relativeCoordPolygon?: Polygon, horizontalLines?: MagneticLine[], verticalLines?: MagneticLine[]): void;
    magnifier?: MagnifierView;
    render(): React.JSX.Element;
    showMagnifier(data: any): void;
    updateMagnifier(data: any): void;
    magnifierOptions(data: any): MagnifierOptions;
    hideMagnifier(): void;
    /**
     * Public API methods
     */
    apply(): Promise<CroppingResult>;
    MAX_ROTATIONS: number;
    toCcwRotations(cw: number): number;
    rotate(rotations: number): Promise<void>;
    detect(): Promise<void>;
    dispose(): void;
    /**
     * Util functions
     */
    get rotations(): number;
    get configuration(): CroppingViewConfiguration;
    BASE_SCALE: number;
    calculateScale(existingRotations: number, appliedRotations: number, calculatedSize: Size): number;
    calculateRatio(calculatedSize: Size): number;
    calculateMargin(size: Size): Point;
    private detectContour;
}
