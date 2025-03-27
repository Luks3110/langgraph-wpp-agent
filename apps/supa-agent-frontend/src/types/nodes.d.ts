export interface INodeBase {
    id: string;
    type: string;
    position: { x: number; y: number };
    configComponent?: React.ReactNode;
}
