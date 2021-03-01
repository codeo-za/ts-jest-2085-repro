export type Nullable<T> = T | null;
export type WithFetchStatus<TResponse, TStatus> = TResponse & {
    __fetchStatus: TStatus;
};
