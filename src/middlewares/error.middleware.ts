import { Request, Response, NextFunction } from "express";

const errorMiddleware=(err:Error,req:Request,res:Response,next:NextFunction)=>{
return res.status(500).json({message:"Internal Server Error"})
}