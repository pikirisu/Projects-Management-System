import { body } from "express-validator";
import { AvailableUserRole, AvailableTaskStatues } from "../utils/constants.js";

/*
 * Passwords are neither trimmed nor coerced.
 *
 * Trimming silently stores something other than what the user typed.
 * Registration used to trim while login did not, so anyone whose password
 * ended in a space -- a paste, or a generated one -- created an account they
 * could not sign in to, and was told only "Invalid credentials".
 *
 * isString is for a different failure: express-validator stringifies before
 * notEmpty(), so `{"$ne": null}` passed validation and reached bcrypt.compare,
 * which throws on a non-string. That answered 500 on an unauthenticated route.
 * bail() stops there, so an object is not also reported as empty.
 */
const passwordField = (field, label) =>
    body(field)
        .isString()
        .withMessage(`${label} must be text`)
        .bail()
        .notEmpty()
        .withMessage(`${label} is required`);

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
        passwordField("password", "Password"),
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
        passwordField("password", "Password"),
    ];
};

const userChangeCurrentPasswordValidator = () => {
    return [
        passwordField("oldPassword", "Old password"),
        passwordField("newPassword", "New password"),
    ];
};

const userUpdateProfileValidator = () => {
    return [
        body("fullName")
            .trim()
            .notEmpty()
            .withMessage("Name is required")
            .isLength({ max: 80 })
            .withMessage("Name must be 80 characters or fewer"),
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
    return [passwordField("newPassword", "Password")];
};

const createProjectValidator = () => {
    return [
        // Trimmed like every other name field. Without it a name of spaces
        // reached Mongoose's own required check, and the client was handed
        // "Project validation failed: name: Path `name` is required."
        body("name").trim().notEmpty().withMessage("Name is required"),
        body("description").optional().trim(),
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
    userUpdateProfileValidator,
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
