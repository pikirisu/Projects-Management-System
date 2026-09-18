import { body } from "express-validator";
import { AvailableUserRole, AvailableTaskStatues } from "../utils/constants.js";
const userRegisterValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLowercase()
            .withMessage("Username must be in lower case")
            .isLength({ min: 3 })
            .withMessage("Username must be at least 3 characters long"),
        body("password").trim().notEmpty().withMessage("Password is required"),
        body("fullName").optional().trim(),
    ];
};

const userLoginValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("password").notEmpty().withMessage("Password is required"),
    ];
};

const userChangeCurrentPasswordValidator = () => {
    return [
        body("oldPassword").notEmpty().withMessage("Old password is required"),
        body("newPassword").notEmpty().withMessage("New password is required"),
    ];
};

const userForgotPasswordValidator = () => {
    return [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
    ];
};

const userResetForgotPasswordValidator = () => {
    return [body("newPassword").notEmpty().withMessage("Password is required")];
};

const createProjectValidator = () => {
    return [
        body("name").notEmpty().withMessage("Name is required"),
        body("description").optional(),
    ];
};

const addMembertoProjectValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("role")
            .notEmpty()
            .withMessage("Role is required")
            .isIn(AvailableUserRole)
            .withMessage("Role is invalid"),
    ];
};

const taskCreateValidator = () => {
    return [
        body("title").trim().notEmpty().withMessage("Title is required"),
        body("description").optional().trim(),
        body("assignedTo")
            .optional()
            .isMongoId()
            .withMessage("Assigned user id is invalid"),
        body("status")
            .optional()
            .isIn(AvailableTaskStatues)
            .withMessage("Status is invalid"),
    ];
};

const taskUpdateValidator = () => {
    return [
        body("title")
            .optional()
            .trim()
            .notEmpty()
            .withMessage("Title cannot be empty"),
        body("description").optional().trim(),
        body("assignedTo")
            .optional()
            .isMongoId()
            .withMessage("Assigned user id is invalid"),
        body("status")
            .optional()
            .isIn(AvailableTaskStatues)
            .withMessage("Status is invalid"),
    ];
};

const subTaskCreateValidator = () => {
    return [body("title").trim().notEmpty().withMessage("Title is required")];
};

const subTaskUpdateValidator = () => {
    return [
        body("title")
            .optional()
            .trim()
            .notEmpty()
            .withMessage("Title cannot be empty"),
        body("isCompleted")
            .optional()
            .isBoolean()
            .withMessage("isCompleted must be a boolean"),
    ];
};

const noteCreateValidator = () => {
    return [
        body("content").trim().notEmpty().withMessage("Content is required"),
    ];
};

const noteUpdateValidator = () => {
    return [
        body("content").trim().notEmpty().withMessage("Content is required"),
    ];
};

export {
    userRegisterValidator,
    userLoginValidator,
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userResetForgotPasswordValidator,
    createProjectValidator,
    addMembertoProjectValidator,
    taskCreateValidator,
    taskUpdateValidator,
    subTaskCreateValidator,
    subTaskUpdateValidator,
    noteCreateValidator,
    noteUpdateValidator,
};
