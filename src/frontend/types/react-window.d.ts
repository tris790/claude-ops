declare module 'react-window' {
    import { ComponentType, CSSProperties, PureComponent } from 'react';

    export type ListProps = {
        children: ComponentType<{ index: number; style: CSSProperties; data?: any }>;
        className?: string;
        direction?: 'ltr' | 'rtl' | 'vertical' | 'horizontal';
        height: number;
        initialScrollOffset?: number;
        innerElementType?: React.ElementType;
        innerRef?: React.Ref<any>;
        innerTagName?: string;
        itemCount: number;
        itemData?: any;
        itemKey?: (index: number, data: any) => any;
        itemSize: number | ((index: number) => number);
        layout?: 'vertical' | 'horizontal';
        onItemsRendered?: (props: {
            overscanStartIndex: number;
            overscanStopIndex: number;
            visibleStartIndex: number;
            visibleStopIndex: number;
        }) => void;
        onScroll?: (props: {
            scrollDirection: 'forward' | 'backward';
            scrollOffset: number;
            scrollUpdateWasRequested: boolean;
        }) => void;
        outerElementType?: React.ElementType;
        outerRef?: React.Ref<any>;
        outerTagName?: string;
        overscanCount?: number;
        style?: CSSProperties;
        useIsScrolling?: boolean;
        width: number | string;
    };

    export class FixedSizeList extends PureComponent<ListProps> {
        scrollTo(scrollOffset: number): void;
        scrollToItem(index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start'): void;
    }

    export class VariableSizeList extends PureComponent<ListProps> {
        scrollTo(scrollOffset: number): void;
        scrollToItem(index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start'): void;
        resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
    }
}
