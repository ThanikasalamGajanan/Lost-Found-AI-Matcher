import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './errorHandler.js';

/**
 * Creates an Express middleware that validates req.body against a Joi schema.
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      throw new AppError(`Validation failed: ${messages}`, 400);
    }

    req.body = value;
    next();
  };
};

// ── Shared Schemas ────────────────────────────

export const lostReportSchema = Joi.object({
  category: Joi.string().required(),
  brand: Joi.string().allow('', null),
  colour: Joi.string().allow('', null),
  description: Joi.string().min(10).required(),
  location: Joi.string().required(),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  lost_at: Joi.date().iso().required(),
  photo_url: Joi.string().uri().allow('', null),
  identifying_info: Joi.string().allow('', null),
});

export const foundReportSchema = Joi.object({
  category: Joi.string().required(),
  brand: Joi.string().allow('', null),
  colour: Joi.string().allow('', null),
  description: Joi.string().min(10).required(),
  location: Joi.string().required(),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  found_at: Joi.date().iso().required(),
  photo_url: Joi.string().uri().allow('', null),
  private_details: Joi.object().allow(null),
});

export const verificationAnswerSchema = Joi.object({
  answer: Joi.string().min(1).required(),
});

export const verificationJudgeSchema = Joi.object({
  is_correct: Joi.boolean().required(),
  attempt_id: Joi.string().uuid().required(),
});
