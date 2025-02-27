import * as React from 'react';

import focusFieldBy from './logic/focusFieldBy';
import getFields from './logic/getFields';
import getFieldsValues from './logic/getFieldsValues';
import getFieldValue from './logic/getFieldValue';
import getFieldValueAs from './logic/getFieldValueAs';
import getNodeParentName from './logic/getNodeParentName';
import getProxyFormState from './logic/getProxyFormState';
import hasValidation from './logic/hasValidation';
import isNameInFieldArray from './logic/isNameInFieldArray';
import setFieldArrayDirtyFields from './logic/setFieldArrayDirtyFields';
import shouldRenderFormState from './logic/shouldRenderFormState';
import skipValidation from './logic/skipValidation';
import validateField from './logic/validateField';
import compact from './utils/compact';
import convertToArrayPayload from './utils/convertToArrayPayload';
import deepEqual from './utils/deepEqual';
import get from './utils/get';
import getValidationModes from './utils/getValidationModes';
import isCheckBoxInput from './utils/isCheckBoxInput';
import isEmptyObject from './utils/isEmptyObject';
import isFileInput from './utils/isFileInput';
import isFunction from './utils/isFunction';
import isHTMLElement from './utils/isHTMLElement';
import isMultipleSelect from './utils/isMultipleSelect';
import isNullOrUndefined from './utils/isNullOrUndefined';
import isProxyEnabled from './utils/isProxyEnabled';
import isRadioInput from './utils/isRadioInput';
import isRadioOrCheckboxFunction from './utils/isRadioOrCheckbox';
import isString from './utils/isString';
import isUndefined from './utils/isUndefined';
import isWeb from './utils/isWeb';
import omit from './utils/omit';
import set from './utils/set';
import Subject from './utils/Subject';
import unset from './utils/unset';
import { EVENTS, UNDEFINED, VALIDATION_MODE } from './constants';
import {
  ChangeHandler,
  DeepPartial,
  DefaultValues,
  EventType,
  Field,
  FieldArrayDefaultValues,
  FieldError,
  FieldErrors,
  FieldName,
  FieldNamesMarkedBoolean,
  FieldPath,
  FieldRefs,
  FieldValues,
  FormState,
  FormStateSubjectRef,
  GetIsDirty,
  InternalFieldName,
  InternalNameSet,
  KeepStateOptions,
  Path,
  PathValue,
  ReadFormState,
  Ref,
  RegisterOptions,
  SetFieldValue,
  SetValueConfig,
  UnpackNestedValue,
  UseFormClearErrors,
  UseFormGetValues,
  UseFormHandleSubmit,
  UseFormProps,
  UseFormRegister,
  UseFormRegisterReturn,
  UseFormReset,
  UseFormReturn,
  UseFormSetError,
  UseFormSetFocus,
  UseFormSetValue,
  UseFormTrigger,
  UseFormUnregister,
  UseFormWatch,
  WatchInternal,
  WatchObserver,
} from './types';

const isWindowUndefined = typeof window === UNDEFINED;

export function useForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext extends object = object
>({
  mode = VALIDATION_MODE.onSubmit,
  reValidateMode = VALIDATION_MODE.onChange,
  resolver,
  context,
  defaultValues = {} as DefaultValues<TFieldValues>,
  shouldFocusError = true,
  shouldUnregister,
  criteriaMode,
}: UseFormProps<TFieldValues, TContext> = {}): UseFormReturn<TFieldValues> {
  const fieldsRef = React.useRef<FieldRefs>({});
  const fieldsNamesRef = React.useRef<Set<InternalFieldName>>(new Set());
  const formStateSubjectRef = React.useRef<FormStateSubjectRef<TFieldValues>>(
    new Subject(),
  );
  const unregisterFieldsNamesRef = React.useRef<Set<InternalFieldName>>(
    new Set(),
  );
  const watchSubjectRef = React.useRef(
    new Subject<{
      name?: InternalFieldName;
      type?: EventType;
      value?: unknown;
    }>(),
  );
  const controllerSubjectRef = React.useRef(
    new Subject<{
      name?: InternalFieldName;
      values: DefaultValues<TFieldValues>;
    }>(),
  );
  const fieldArraySubjectRef = React.useRef(
    new Subject<{
      name?: InternalFieldName;
      fields: any;
      isReset?: boolean;
    }>(),
  );
  const fieldArrayDefaultValuesRef = React.useRef<FieldArrayDefaultValues>({});
  const watchFieldsRef = React.useRef<InternalNameSet>(new Set());
  const isMountedRef = React.useRef(false);
  const fieldsWithValidationRef = React.useRef<
    FieldNamesMarkedBoolean<TFieldValues>
  >({});
  const validFieldsRef = React.useRef<FieldNamesMarkedBoolean<TFieldValues>>(
    {},
  );
  const defaultValuesRef = React.useRef<DefaultValues<TFieldValues>>(
    defaultValues,
  );
  const isWatchAllRef = React.useRef(false);
  const contextRef = React.useRef(context);
  const resolverRef = React.useRef(resolver);
  const fieldArrayNamesRef = React.useRef<InternalNameSet>(new Set());
  const validationMode = getValidationModes(mode);
  const isValidateAllFieldCriteria = criteriaMode === VALIDATION_MODE.all;
  const [formState, updateFormState] = React.useState<FormState<TFieldValues>>({
    isDirty: false,
    isValidating: false,
    dirtyFields: {},
    isSubmitted: false,
    submitCount: 0,
    touchedFields: {},
    isSubmitting: false,
    isSubmitSuccessful: false,
    isValid: !validationMode.isOnSubmit,
    errors: {},
  });
  const readFormStateRef = React.useRef<ReadFormState>({
    isDirty: !isProxyEnabled,
    dirtyFields: !isProxyEnabled,
    touchedFields: !isProxyEnabled,
    isValidating: !isProxyEnabled,
    isValid: !isProxyEnabled,
    errors: !isProxyEnabled,
  });
  const formStateRef = React.useRef(formState);

  contextRef.current = context;
  resolverRef.current = resolver;

  const getIsValid = () =>
    (formStateRef.current.isValid =
      deepEqual(validFieldsRef.current, fieldsWithValidationRef.current) &&
      isEmptyObject(formStateRef.current.errors));

  const shouldRenderBaseOnError = React.useCallback(
    (
      name: InternalFieldName,
      error?: FieldError,
      shouldRender: boolean | null = false,
      state: {
        dirty?: FieldNamesMarkedBoolean<TFieldValues>;
        isDirty?: boolean;
        touched?: FieldNamesMarkedBoolean<TFieldValues>;
      } = {},
      isValid?: boolean,
      isWatched?: boolean,
    ): boolean | void => {
      const previousError = get(formStateRef.current.errors, name);

      let shouldReRender =
        shouldRender ||
        !deepEqual(previousError, error, true) ||
        (readFormStateRef.current.isValid &&
          isUndefined(error) &&
          get(fieldsWithValidationRef.current, name) &&
          !get(validFieldsRef.current, name));

      if (error) {
        unset(validFieldsRef.current, name);
        shouldReRender =
          shouldReRender ||
          !previousError ||
          !deepEqual(previousError, error, true);
        set(formStateRef.current.errors, name, error);
      } else {
        if (get(fieldsWithValidationRef.current, name) || resolverRef.current) {
          set(validFieldsRef.current, name, true);
          shouldReRender = shouldReRender || previousError;
        }

        unset(formStateRef.current.errors, name);
      }

      if (
        (shouldReRender && !isNullOrUndefined(shouldRender)) ||
        !isEmptyObject(state) ||
        isWatched
      ) {
        const updatedFormState = {
          ...state,
          isValid: resolverRef.current ? !!isValid : getIsValid(),
          errors: formStateRef.current.errors,
          name,
        };

        formStateRef.current = {
          ...formStateRef.current,
          ...updatedFormState,
        };

        formStateSubjectRef.current.next(
          isWatched ? { name } : updatedFormState,
        );
      }

      formStateSubjectRef.current.next({
        isValidating: false,
      });
    },
    [],
  );

  const setFieldValue = React.useCallback(
    (
      name: InternalFieldName,
      rawValue: SetFieldValue<TFieldValues>,
      options: SetValueConfig = {},
      shouldRender?: boolean,
      shouldRegister?: boolean,
    ) => {
      shouldRegister && register(name as Path<TFieldValues>);
      const _f = get(fieldsRef.current, name, {})._f as Field['_f'];

      if (_f) {
        const value =
          isWeb && isHTMLElement(_f.ref) && isNullOrUndefined(rawValue)
            ? ''
            : rawValue;
        _f.value = getFieldValueAs(rawValue, _f);

        if (isRadioInput(_f.ref)) {
          (_f.refs || []).forEach(
            (radioRef: HTMLInputElement) =>
              (radioRef.checked = radioRef.value === value),
          );
        } else if (isFileInput(_f.ref) && !isString(value)) {
          _f.ref.files = value as FileList;
        } else if (isMultipleSelect(_f.ref)) {
          [..._f.ref.options].forEach(
            (selectRef) =>
              (selectRef.selected = (value as string[]).includes(
                selectRef.value,
              )),
          );
        } else if (isCheckBoxInput(_f.ref) && _f.refs) {
          _f.refs.length > 1
            ? _f.refs.forEach(
                (checkboxRef) =>
                  (checkboxRef.checked = Array.isArray(value)
                    ? !!(value as []).find(
                        (data: string) => data === checkboxRef.value,
                      )
                    : value === checkboxRef.value),
              )
            : (_f.refs[0].checked = !!value);
        } else {
          _f.ref.value = value;
        }

        if (shouldRender) {
          const values = getFieldsValues(fieldsRef);
          set(values, name, rawValue);
          controllerSubjectRef.current.next({
            values: {
              ...defaultValuesRef.current,
              ...values,
            } as DefaultValues<TFieldValues>,
            name,
          });
        }

        options.shouldDirty && updateAndGetDirtyState(name, value);
        options.shouldValidate && trigger(name as Path<TFieldValues>);
      }
    },
    [],
  );

  const getIsDirty: GetIsDirty = React.useCallback((name, data) => {
    const formValues = getFieldsValues(fieldsRef);

    name && data && set(formValues, name, data);

    return !deepEqual(formValues, defaultValuesRef.current);
  }, []);

  const updateAndGetDirtyState = React.useCallback(
    (
      name: InternalFieldName,
      inputValue: unknown,
      shouldRender = true,
    ): Partial<
      Pick<FormState<TFieldValues>, 'dirtyFields' | 'isDirty' | 'touchedFields'>
    > => {
      if (
        readFormStateRef.current.isDirty ||
        readFormStateRef.current.dirtyFields
      ) {
        const isFieldDirty = !deepEqual(
          get(defaultValuesRef.current, name),
          inputValue,
        );
        const isDirtyFieldExist = get(formStateRef.current.dirtyFields, name);
        const previousIsDirty = formStateRef.current.isDirty;

        isFieldDirty
          ? set(formStateRef.current.dirtyFields, name, true)
          : unset(formStateRef.current.dirtyFields, name);

        formStateRef.current.isDirty = getIsDirty();

        const state = {
          isDirty: formStateRef.current.isDirty,
          dirtyFields: formStateRef.current.dirtyFields,
          name,
        };

        const isChanged =
          (readFormStateRef.current.isDirty &&
            previousIsDirty !== state.isDirty) ||
          (readFormStateRef.current.dirtyFields &&
            isDirtyFieldExist !== get(formStateRef.current.dirtyFields, name));

        isChanged && shouldRender && formStateSubjectRef.current.next(state);

        return isChanged ? state : {};
      }

      return {};
    },
    [],
  );

  const executeValidation = React.useCallback(
    async (
      name: InternalFieldName,
      skipReRender?: boolean | null,
    ): Promise<boolean> => {
      const error = (
        await validateField(
          get(fieldsRef.current, name) as Field,
          isValidateAllFieldCriteria,
        )
      )[name];

      shouldRenderBaseOnError(name, error, skipReRender);

      return isUndefined(error);
    },
    [isValidateAllFieldCriteria],
  );

  const executeSchemaOrResolverValidation = React.useCallback(
    async (
      names: InternalFieldName[],
      currentNames: FieldName<TFieldValues>[] = [],
    ) => {
      const { errors } = await resolverRef.current!(
        getFieldsValues(
          fieldsRef,
          shouldUnregister ? {} : defaultValuesRef.current,
        ),
        contextRef.current,
        {
          criteriaMode,
          names: currentNames,
          fields: getFields(fieldsNamesRef.current, fieldsRef.current),
        },
      );

      for (const name of names) {
        const error = get(errors, name);
        error
          ? set(formStateRef.current.errors, name, error)
          : unset(formStateRef.current.errors, name);
      }

      return errors;
    },
    [criteriaMode],
  );

  const validateForm = async (fieldsRef: FieldRefs) => {
    let isValid = true;

    for (const name in fieldsRef) {
      const field = fieldsRef[name];

      if (field) {
        const _f = field._f;
        const current = omit(field, '_f');

        if (_f) {
          const fieldError = await validateField(
            field,
            isValidateAllFieldCriteria,
          );

          if (fieldError[_f.name]) {
            isValid = false;
            set(formStateRef.current.errors, _f.name, fieldError[_f.name]);
            unset(validFieldsRef.current, _f.name);
          } else if (get(fieldsWithValidationRef.current, _f.name)) {
            set(validFieldsRef.current, _f.name, true);
            unset(formStateRef.current.errors, _f.name);
          }
        }

        current && (await validateForm(current));
      }
    }

    return isValid;
  };

  const trigger: UseFormTrigger<TFieldValues> = React.useCallback(
    async (name) => {
      const fields = isUndefined(name)
        ? Object.keys(fieldsRef.current)
        : (convertToArrayPayload(name) as InternalFieldName[]);
      let isValid;
      let schemaResult: FieldErrors<TFieldValues> | {} = {};

      formStateSubjectRef.current.next({
        isValidating: true,
      });

      if (resolverRef.current) {
        schemaResult = await executeSchemaOrResolverValidation(
          fields,
          isUndefined(name) ? undefined : (fields as FieldName<TFieldValues>[]),
        );
        isValid = fields.every((name) => !get(schemaResult, name));
      } else {
        isValid = isUndefined(name)
          ? await validateForm(fieldsRef.current)
          : (
              await Promise.all(
                fields
                  .filter((fieldName) => get(fieldsRef.current, fieldName))
                  .map(
                    async (fieldName) =>
                      await executeValidation(fieldName, null),
                  ),
              )
            ).every(Boolean);
      }

      formStateSubjectRef.current.next({
        ...(isString(name) ? { name } : {}),
        errors: formStateRef.current.errors,
        isValidating: false,
        isValid: resolverRef.current
          ? isEmptyObject(schemaResult)
          : getIsValid(),
      });

      return isValid;
    },
    [executeSchemaOrResolverValidation, executeValidation],
  );

  const setInternalValues = React.useCallback(
    (
      name: FieldPath<TFieldValues>,
      value: UnpackNestedValue<
        PathValue<TFieldValues, FieldPath<TFieldValues>>
      >,
      options: SetValueConfig,
    ) =>
      Object.entries(value).forEach(([inputKey, inputValue]) => {
        const fieldName = `${name}.${inputKey}` as Path<TFieldValues>;
        const field = get(fieldsRef.current, fieldName);
        const isFieldArray = fieldArrayNamesRef.current.has(name);

        isFieldArray || (field && !field._f)
          ? setInternalValues(
              fieldName,
              inputValue as SetFieldValue<TFieldValues>,
              options,
            )
          : setFieldValue(
              fieldName,
              inputValue as SetFieldValue<TFieldValues>,
              options,
              true,
              !field,
            );
      }),
    [trigger],
  );

  const isFieldWatched = (name: FieldPath<TFieldValues>) =>
    isWatchAllRef.current ||
    watchFieldsRef.current.has(name) ||
    watchFieldsRef.current.has((name.match(/\w+/) || [])[0]);

  const updateValidAndValue = (
    name: InternalFieldName,
    options?: RegisterOptions,
    ref?: Ref,
    isWithinRefCallback?: boolean,
  ) => {
    const field = get(fieldsRef.current, name) as Field;
    const defaultValue = isUndefined(field._f.value)
      ? get(defaultValuesRef.current, name)
      : field._f.value;

    if (field && !isUndefined(defaultValue)) {
      if (ref && (ref as HTMLInputElement).defaultChecked) {
        field._f.value = getFieldValue(field);
      } else if (!isNameInFieldArray(fieldArrayNamesRef.current, name)) {
        setFieldValue(name, defaultValue);
      } else {
        field._f.value = defaultValue;
      }
    }

    if (
      (!isUndefined(defaultValue) || isWithinRefCallback) &&
      hasValidation(options, field._f.mount) &&
      !validationMode.isOnSubmit &&
      field &&
      readFormStateRef.current.isValid
    ) {
      validateField(field, isValidateAllFieldCriteria).then((error) => {
        isEmptyObject(error)
          ? set(validFieldsRef.current, name, true)
          : unset(validFieldsRef.current, name);

        formStateRef.current.isValid !== getIsValid() &&
          updateFormState({ ...formStateRef.current, isValid: getIsValid() });
      });
    }

    return defaultValue;
  };

  const setValue: UseFormSetValue<TFieldValues> = (
    name,
    value,
    options = {},
  ) => {
    const field = get(fieldsRef.current, name);
    const isFieldArray = fieldArrayNamesRef.current.has(name);

    if (isFieldArray) {
      fieldArraySubjectRef.current.next({
        fields: value,
        name,
        isReset: true,
      });

      if (
        (readFormStateRef.current.isDirty ||
          readFormStateRef.current.dirtyFields) &&
        options.shouldDirty
      ) {
        set(
          formStateRef.current.dirtyFields,
          name,
          setFieldArrayDirtyFields(
            value,
            get(defaultValuesRef.current, name, []),
            get(formStateRef.current.dirtyFields, name, []),
          ),
        );

        formStateSubjectRef.current.next({
          name,
          dirtyFields: formStateRef.current.dirtyFields,
          isDirty: getIsDirty(name, value),
        });
      }

      !(value as []).length &&
        set(fieldsRef.current, name, []) &&
        set(fieldArrayDefaultValuesRef.current, name, []);
    }

    (field && !field._f) || isFieldArray
      ? setInternalValues(name, value, isFieldArray ? {} : options)
      : setFieldValue(name, value, options, true, !field);

    isFieldWatched(name) && formStateSubjectRef.current.next({});
    watchSubjectRef.current.next({ name, value });
  };

  const handleChange: ChangeHandler = React.useCallback(
    async ({ type, target, target: { value, type: inputType } }) => {
      let name = (target as Ref)!.name;
      let error;
      let isValid;
      const field = get(fieldsRef.current, name) as Field;

      if (field) {
        let inputValue = inputType ? getFieldValue(field) : undefined;
        inputValue = isUndefined(inputValue) ? value : inputValue;

        const isBlurEvent = type === EVENTS.BLUR;
        const {
          isOnBlur: isReValidateOnBlur,
          isOnChange: isReValidateOnChange,
        } = getValidationModes(reValidateMode);

        const shouldSkipValidation =
          (!hasValidation(field._f, field._f.mount) &&
            !resolverRef.current &&
            !get(formStateRef.current.errors, name)) ||
          skipValidation({
            isBlurEvent,
            isTouched: !!get(formStateRef.current.touchedFields, name),
            isSubmitted: formStateRef.current.isSubmitted,
            isReValidateOnBlur,
            isReValidateOnChange,
            ...validationMode,
          });
        const isWatched =
          !isBlurEvent && isFieldWatched(name as FieldPath<TFieldValues>);

        if (!isUndefined(inputValue)) {
          field._f.value = inputValue;
        }

        const state = updateAndGetDirtyState(name, field._f.value, false);

        if (isBlurEvent && !get(formStateRef.current.touchedFields, name)) {
          set(formStateRef.current.touchedFields, name, true);
          readFormStateRef.current.touchedFields &&
            (state.touchedFields = formStateRef.current.touchedFields);
        }

        let shouldRender = !isEmptyObject(state) || isWatched;

        if (shouldSkipValidation) {
          !isBlurEvent &&
            watchSubjectRef.current.next({
              name,
              type,
              value: inputValue,
            });
          return (
            shouldRender &&
            formStateSubjectRef.current.next(
              isWatched ? { name } : { ...state, name },
            )
          );
        }

        formStateSubjectRef.current.next({
          isValidating: true,
        });

        if (resolverRef.current) {
          const { errors } = await resolverRef.current(
            getFieldsValues(
              fieldsRef,
              shouldUnregister ? {} : defaultValuesRef.current,
            ),
            contextRef.current,
            {
              criteriaMode,
              fields: getFields([name], fieldsRef.current),
              names: [name as FieldName<TFieldValues>],
            },
          );
          const previousFormIsValid = formStateRef.current.isValid;
          error = get(errors, name);

          if (isCheckBoxInput(target as Ref) && !error) {
            const parentNodeName = getNodeParentName(name);
            const currentError = get(errors, parentNodeName, {});
            currentError.type && currentError.message && (error = currentError);

            if (
              currentError ||
              get(formStateRef.current.errors, parentNodeName)
            ) {
              name = parentNodeName;
            }
          }

          isValid = isEmptyObject(errors);

          previousFormIsValid !== isValid && (shouldRender = true);
        } else {
          error = (await validateField(field, isValidateAllFieldCriteria))[
            name
          ];
        }

        !isBlurEvent &&
          watchSubjectRef.current.next({
            name,
            type,
            value: inputValue,
          });
        shouldRenderBaseOnError(
          name,
          error,
          shouldRender,
          state,
          isValid,
          isWatched,
        );
      }
    },
    [],
  );

  const getValues: UseFormGetValues<TFieldValues> = (
    fieldNames?:
      | FieldPath<TFieldValues>
      | ReadonlyArray<FieldPath<TFieldValues>>,
  ) => {
    const values = isMountedRef.current
      ? getFieldsValues(
          fieldsRef,
          shouldUnregister ? {} : defaultValuesRef.current,
        )
      : defaultValuesRef.current;

    return isUndefined(fieldNames)
      ? values
      : isString(fieldNames)
      ? get(values, fieldNames as InternalFieldName)
      : fieldNames.map((name) => get(values, name as InternalFieldName));
  };

  const updateIsValid = React.useCallback(
    async (values = {}) => {
      const previousIsValid = formStateRef.current.isValid;

      if (resolver) {
        const { errors } = await resolverRef.current!(
          {
            ...getFieldsValues(
              fieldsRef,
              shouldUnregister ? {} : defaultValuesRef.current,
            ),
            ...values,
          },
          contextRef.current,
          {
            criteriaMode,
            fields: getFields(fieldsNamesRef.current, fieldsRef.current),
          },
        );
        formStateRef.current.isValid = isEmptyObject(errors);
      } else {
        getIsValid();
      }

      previousIsValid !== formStateRef.current.isValid &&
        formStateSubjectRef.current.next({
          isValid: formStateRef.current.isValid,
        });
    },
    [criteriaMode],
  );

  const clearErrors: UseFormClearErrors<TFieldValues> = (name) => {
    name
      ? convertToArrayPayload(name).forEach((inputName) =>
          unset(formStateRef.current.errors, inputName),
        )
      : (formStateRef.current.errors = {});

    formStateSubjectRef.current.next({
      errors: formStateRef.current.errors,
    });
  };

  const setError: UseFormSetError<TFieldValues> = (name, error, options) => {
    const ref = (
      ((get(fieldsRef.current, name) as Field) || { _f: {} })._f || {}
    ).ref;

    set(formStateRef.current.errors, name, {
      ...error,
      ref,
    });

    formStateSubjectRef.current.next({
      name,
      errors: formStateRef.current.errors,
      isValid: false,
    });

    options && options.shouldFocus && ref && ref.focus && ref.focus();
  };

  const watchInternal: WatchInternal<TFieldValues> = React.useCallback(
    (fieldNames, defaultValue, isGlobal) => {
      const isArrayNames = Array.isArray(fieldNames);
      const fieldValues = isMountedRef.current
        ? getFieldsValues(fieldsRef, defaultValuesRef.current)
        : isUndefined(defaultValue)
        ? defaultValuesRef.current
        : isArrayNames
        ? defaultValue || {}
        : { [fieldNames as string]: defaultValue };

      if (isUndefined(fieldNames)) {
        isGlobal && (isWatchAllRef.current = true);
        return fieldValues;
      }

      const result = [];

      for (const fieldName of isArrayNames ? fieldNames : [fieldNames]) {
        isGlobal && watchFieldsRef.current.add(fieldName as string);
        result.push(get(fieldValues, fieldName as string));
      }

      return isArrayNames ? result : result[0];
    },
    [],
  );

  const watch: UseFormWatch<TFieldValues> = (
    fieldName?:
      | FieldPath<TFieldValues>
      | ReadonlyArray<FieldPath<TFieldValues>>
      | WatchObserver<TFieldValues>,
    defaultValue?: unknown,
  ) =>
    isFunction(fieldName)
      ? watchSubjectRef.current.subscribe({
          next: (info) =>
            fieldName(
              watchInternal(
                undefined,
                defaultValue as UnpackNestedValue<DeepPartial<TFieldValues>>,
              ) as UnpackNestedValue<TFieldValues>,
              info,
            ),
        })
      : watchInternal(
          fieldName as string | string[],
          defaultValue as UnpackNestedValue<DeepPartial<TFieldValues>>,
          true,
        );

  const unregister: UseFormUnregister<TFieldValues> = (name, options = {}) => {
    for (const inputName of name
      ? convertToArrayPayload(name)
      : Object.keys(fieldsNamesRef.current)) {
      fieldsNamesRef.current.delete(inputName);
      fieldArrayNamesRef.current.delete(inputName);

      if (get(fieldsRef.current, inputName) as Field) {
        if (!options.keepIsValid) {
          unset(fieldsWithValidationRef.current, inputName);
          unset(validFieldsRef.current, inputName);
        }
        !options.keepError && unset(formStateRef.current.errors, inputName);
        !options.keepValue && unset(fieldsRef.current, inputName);
        !options.keepDirty &&
          unset(formStateRef.current.dirtyFields, inputName);
        !options.keepTouched &&
          unset(formStateRef.current.touchedFields, inputName);
        !shouldUnregister &&
          !options.keepDefaultValue &&
          unset(defaultValuesRef.current, inputName);

        watchSubjectRef.current.next({
          name: inputName,
        });
      }
    }

    formStateSubjectRef.current.next({
      ...formStateRef.current,
      ...(!options.keepDirty ? {} : { isDirty: getIsDirty() }),
      ...(resolverRef.current ? {} : { isValid: getIsValid() }),
    });
    !options.keepIsValid && updateIsValid();
  };

  const registerFieldRef = (
    name: InternalFieldName,
    ref: HTMLInputElement,
    options?: RegisterOptions,
  ): ((name: InternalFieldName) => void) | void => {
    register(name as FieldPath<TFieldValues>, options);
    let field = get(fieldsRef.current, name) as Field;

    const isRadioOrCheckbox = isRadioOrCheckboxFunction(ref);

    if (
      ref === field._f.ref ||
      (isWeb && isHTMLElement(field._f.ref) && !isHTMLElement(ref)) ||
      (isRadioOrCheckbox &&
        Array.isArray(field._f.refs) &&
        compact(field._f.refs).find((option) => option === ref))
    ) {
      return;
    }

    field = {
      _f: isRadioOrCheckbox
        ? {
            ...field._f,
            refs: [
              ...compact(field._f.refs || []).filter(
                (ref) => isHTMLElement(ref) && document.contains(ref),
              ),
              ref,
            ],
            ref: { type: ref.type, name },
          }
        : {
            ...field._f,
            ref,
          },
    };

    set(fieldsRef.current, name, field);

    const defaultValue = updateValidAndValue(name, options, ref, true);

    if (
      isRadioOrCheckbox && Array.isArray(defaultValue)
        ? !deepEqual(get(fieldsRef.current, name)._f.value, defaultValue)
        : isUndefined(get(fieldsRef.current, name)._f.value)
    ) {
      get(fieldsRef.current, name)._f.value = getFieldValue(
        get(fieldsRef.current, name),
      );
    }
  };

  const register: UseFormRegister<TFieldValues> = React.useCallback(
    (name, options) => {
      const isInitialRegister = !get(fieldsRef.current, name);

      set(fieldsRef.current, name, {
        _f: {
          ...(isInitialRegister
            ? { ref: { name } }
            : {
                ref: (get(fieldsRef.current, name)._f || {}).ref,
                ...get(fieldsRef.current, name)._f,
              }),
          name,
          mount: true,
          ...options,
        },
      });
      hasValidation(options, true) &&
        set(fieldsWithValidationRef.current, name, true);
      fieldsNamesRef.current.add(name);
      isInitialRegister && updateValidAndValue(name, options);

      return isWindowUndefined
        ? ({ name: name as InternalFieldName } as UseFormRegisterReturn)
        : {
            name,
            onChange: handleChange,
            onBlur: handleChange,
            ref: (ref: HTMLInputElement | null): void => {
              if (ref) {
                registerFieldRef(name, ref, options);
              } else {
                const field = get(fieldsRef.current, name) as Field;
                field && (field._f.mount = false);

                if (
                  isWeb &&
                  (shouldUnregister || (options && options.shouldUnregister))
                ) {
                  unregisterFieldsNamesRef.current.add(name);
                }
              }
            },
          };
    },
    [defaultValuesRef.current],
  );

  const handleSubmit: UseFormHandleSubmit<TFieldValues> = React.useCallback(
    (onValid, onInvalid) => async (e) => {
      if (e) {
        e.preventDefault && e.preventDefault();
        e.persist && e.persist();
      }
      let hasNoPromiseError = true;
      let fieldValues = getFieldsValues(
        fieldsRef,
        shouldUnregister ? {} : defaultValuesRef.current,
      );

      formStateSubjectRef.current.next({
        isSubmitting: true,
      });

      try {
        if (resolverRef.current) {
          const { errors, values } = await resolverRef.current(
            fieldValues,
            contextRef.current,
            {
              criteriaMode,
              fields: getFields(fieldsNamesRef.current, fieldsRef.current),
            },
          );
          formStateRef.current.errors = errors;
          fieldValues = values;
        } else {
          await validateForm(fieldsRef.current);
        }

        if (
          isEmptyObject(formStateRef.current.errors) &&
          Object.keys(formStateRef.current.errors).every((name) =>
            get(fieldValues, name),
          )
        ) {
          formStateSubjectRef.current.next({
            errors: {},
            isSubmitting: true,
          });
          await onValid(fieldValues, e);
        } else {
          onInvalid && (await onInvalid(formStateRef.current.errors, e));
          shouldFocusError &&
            focusFieldBy(
              fieldsRef.current,
              (key: string) => get(formStateRef.current.errors, key),
              fieldsNamesRef.current,
            );
        }
      } catch {
        hasNoPromiseError = false;
      } finally {
        formStateRef.current.isSubmitted = true;
        formStateSubjectRef.current.next({
          isSubmitted: true,
          isSubmitting: false,
          isSubmitSuccessful:
            isEmptyObject(formStateRef.current.errors) && hasNoPromiseError,
          submitCount: formStateRef.current.submitCount + 1,
          errors: formStateRef.current.errors,
        });
      }
    },
    [shouldFocusError, isValidateAllFieldCriteria, criteriaMode],
  );

  const resetFromState = React.useCallback(
    (
      {
        keepErrors,
        keepDirty,
        keepIsSubmitted,
        keepTouched,
        keepDefaultValues,
        keepIsValid,
        keepSubmitCount,
      }: KeepStateOptions,
      values?: DefaultValues<TFieldValues>,
    ) => {
      if (!keepIsValid) {
        validFieldsRef.current = {};
        fieldsWithValidationRef.current = {};
      }

      watchFieldsRef.current = new Set();
      isWatchAllRef.current = false;

      formStateSubjectRef.current.next({
        submitCount: keepSubmitCount ? formStateRef.current.submitCount : 0,
        isDirty: keepDirty
          ? formStateRef.current.isDirty
          : keepDefaultValues
          ? deepEqual(values, defaultValuesRef.current)
          : false,
        isSubmitted: keepIsSubmitted ? formStateRef.current.isSubmitted : false,
        isValid: keepIsValid
          ? formStateRef.current.isValid
          : !!updateIsValid(values),
        dirtyFields: keepDirty ? formStateRef.current.dirtyFields : {},
        touchedFields: keepTouched ? formStateRef.current.touchedFields : {},
        errors: keepErrors ? formStateRef.current.errors : {},
        isSubmitting: false,
        isSubmitSuccessful: false,
      });
    },
    [],
  );

  const reset: UseFormReset<TFieldValues> = (values, keepStateOptions = {}) => {
    const updatedValues = values || defaultValuesRef.current;

    if (isWeb && !keepStateOptions.keepValues) {
      for (const name of fieldsNamesRef.current) {
        const field = get(fieldsRef.current, name);
        if (field && field._f) {
          const inputRef = Array.isArray(field._f.refs)
            ? field._f.refs[0]
            : field._f.ref;

          if (isHTMLElement(inputRef)) {
            try {
              inputRef.closest('form')!.reset();
              break;
            } catch {}
          }
        }
      }
    }

    !keepStateOptions.keepDefaultValues &&
      (defaultValuesRef.current = { ...updatedValues });

    if (!keepStateOptions.keepValues) {
      fieldsRef.current = {};

      controllerSubjectRef.current.next({
        values: { ...updatedValues },
      });

      watchSubjectRef.current.next({
        value: { ...updatedValues },
      });

      fieldArraySubjectRef.current.next({
        fields: { ...updatedValues },
        isReset: true,
      });
    }

    resetFromState(keepStateOptions, values);
    isMountedRef.current = false;
  };

  const setFocus: UseFormSetFocus<TFieldValues> = (name) =>
    get(fieldsRef.current, name)._f.ref.focus();

  React.useEffect(() => {
    const formStateSubscription = formStateSubjectRef.current.subscribe({
      next(formState) {
        if (shouldRenderFormState(formState, readFormStateRef.current, true)) {
          formStateRef.current = {
            ...formStateRef.current,
            ...formState,
          };
          updateFormState(formStateRef.current);
        }
      },
    });

    const useFieldArraySubscription = fieldArraySubjectRef.current.subscribe({
      next(state) {
        if (state.fields && state.name && readFormStateRef.current.isValid) {
          const values = getFieldsValues(fieldsRef);
          set(values, state.name, state.fields);
          updateIsValid(values);
        }
      },
    });

    resolverRef.current && readFormStateRef.current.isValid && updateIsValid();

    return () => {
      watchSubjectRef.current.unsubscribe();
      formStateSubscription.unsubscribe();
      useFieldArraySubscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const isLiveInDom = (ref: Ref) =>
      !isHTMLElement(ref) || !document.contains(ref);

    isMountedRef.current = true;
    unregisterFieldsNamesRef.current.forEach((name) => {
      const field = get(fieldsRef.current, name) as Field;

      field &&
        (field._f.refs
          ? field._f.refs.every(isLiveInDom)
          : isLiveInDom(field._f.ref)) &&
        unregister(name as FieldPath<TFieldValues>);
    });
    unregisterFieldsNamesRef.current = new Set();
  });

  return {
    control: React.useMemo(
      () => ({
        register,
        isWatchAllRef,
        watchFieldsRef,
        getIsDirty,
        formStateSubjectRef,
        fieldArraySubjectRef,
        controllerSubjectRef,
        watchSubjectRef,
        watchInternal,
        fieldsRef,
        validFieldsRef,
        fieldsWithValidationRef,
        fieldArrayNamesRef,
        readFormStateRef,
        formStateRef,
        defaultValuesRef,
        fieldArrayDefaultValuesRef,
        unregister,
        shouldUnmountUnregister: shouldUnregister,
      }),
      [],
    ),
    formState: getProxyFormState<TFieldValues>(
      isProxyEnabled,
      formState,
      readFormStateRef,
    ),
    trigger,
    register,
    handleSubmit,
    watch: React.useCallback(watch, []),
    setValue: React.useCallback(setValue, [setInternalValues]),
    getValues: React.useCallback(getValues, []),
    reset: React.useCallback(reset, []),
    clearErrors: React.useCallback(clearErrors, []),
    unregister: React.useCallback(unregister, []),
    setError: React.useCallback(setError, []),
    setFocus: React.useCallback(setFocus, []),
  };
}
