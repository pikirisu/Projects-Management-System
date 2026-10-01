import { body } from "express-validator";
import { validate } from "../middlewares/validator.middleware.js";
import {
    ALL_ROLES,
    TASK_PRIORITIES,
    TASK_STATUSES,
} from "../utils/constants.js";

/** A rule set ends with `validate`, so a route lists it as one middleware. */
const rules = (...chains) => [...chains, validate];

const email = () =>
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .bail()
        .isEmail()
        .withMessage("Email is invalid");

// Decision: passwords are never trimmed, since that would store something other
// than what was typed, and must be strings: `{"$ne": null}` would otherwise
// reach bcrypt.compare, which throws, and answer 500 on a public route.
const password = (field, label = "Password") =>
    body(field)
        .isString()
        .withMessage(`${label} must be text`)
        .bail()
        .notEmpty()
        .withMessage(`${label} is required`);

/** Only passwords being set are held to a minimum, never one being checked. */
const newPassword = (field, label) =>
    password(field, label)
        .bail()
        .isLength({ min: 8 })
        .withMessage(`${label} must be at least 8 characters`);

const title = ({ optional }) =>
    optional
        ? body("title")
              .optional()
              .trim()
              .notEmpty()
              .withMessage("Title cannot be empty")
        : body("title").trim().notEmpty().withMessage("Title is required");

// ---- auth -------------------------------------------------------------------

export const registerRules = rules(
    email(),
    body("username")
        .trim()
        .notEmpty()
        .withMessage("Username is required")
        .bail()
        .isLowercase()
        .withMessage("Username must be lowercase")
        .isLength({ min: 3 })
        .withMessage("Username must be at least 3 characters"),
    newPassword("password", "Password"),
    body("fullName").optional().trim(),
);

export const loginRules = rules(email(), password("password"));

export const forgotPasswordRules = rules(email());

export const resetPasswordRules = rules(newPassword("newPassword", "Password"));

export const changePasswordRules = rules(
    password("oldPassword", "Current password"),
    newPassword("newPassword", "New password"),
);

export const profileRules = rules(
    body("fullName")
        .trim()
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ max: 80 })
        .withMessage("Name must be 80 characters or fewer"),
);

// ---- projects ----------------------------------------------------------------

export const projectRules = rules(
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("description").optional().trim(),
);

export const addMemberRules = rules(
    email(),
    body("role").isIn(ALL_ROLES).withMessage("Role is invalid"),
);

export const memberRoleRules = rules(
    body("newRole").isIn(ALL_ROLES).withMessage("Role is invalid"),
);

// ---- tasks -------------------------------------------------------------------

/** Create requires a title; update makes every field optional. */
const taskRules = ({ optional }) =>
    rules(
        title({ optional }),
        body("description").optional().trim(),
        body("status")
            .optional()
            .isIn(TASK_STATUSES)
            .withMessage("Status is invalid"),
        body("priority")
            .optional()
            .isIn(TASK_PRIORITIES)
            .withMessage("Priority is invalid"),
        // Empty (null or "") is allowed: it clears the assignee or due date.
        body("assignedTo")
            .optional({ values: "falsy" })
            .isMongoId()
            .withMessage("Assignee is invalid"),
        body("dueDate")
            .optional({ values: "falsy" })
            .isISO8601()
            .withMessage("Due date is invalid"),
    );

export const createTaskRules = taskRules({ optional: false });
export const updateTaskRules = taskRules({ optional: true });

export const createSubtaskRules = rules(title({ optional: false }));

export const updateSubtaskRules = rules(
    title({ optional: true }),
    body("isCompleted")
        .optional()
        .isBoolean()
        .withMessage("isCompleted must be true or false"),
);

// ---- notes -------------------------------------------------------------------

export const noteRules = rules(
    body("content").trim().notEmpty().withMessage("Content is required"),
);
