import api from "./axios";

export const getBoardApi        = ()       => api.get("/board");
export const addToBoardApi      = (stock)  => api.post("/board", stock);
export const removeFromBoardApi = (symbol) => api.delete(`/board/${symbol}`);

// -- Board layout persistence — saves section config per user on backend ------─
export const getBoardLayout  = ()       => api.get("/board/layout");
export const saveBoardLayout = (layout) => api.post("/board/layout", { layout });