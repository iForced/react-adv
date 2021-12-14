import { all, call, put, take, delay } from "redux-saga/effects";
import { eventChannel } from "redux-saga";
import { appName } from "../config";
import { Record } from "immutable";
import apiService from "../services/api";
import { useSelector } from "react-redux";

/**
 * Constants
 * */
export const moduleName = "auth";
const prefix = `${appName}/${moduleName}`;

export const SIGN_UP_REQUEST = `${prefix}/SIGN_UP_REQUEST`;
export const SIGN_UP_START = `${prefix}/SIGN_UP_START`;
export const SIGN_UP_SUCCESS = `${prefix}/SIGN_UP_SUCCESS`;
export const SIGN_UP_ERROR = `${prefix}/SIGN_UP_ERROR`;
export const SIGN_UP_TIMEOUT_LIMIT = `${prefix}/SIGN_UP_TIMEOUT_LIMIT`;
export const SIGN_UP_HARD_LIMIT = `${prefix}/SIGN_UP_HARD_LIMIT`;

export const SIGN_OUT_SUCCESS = `${prefix}/SIGN_OUT_SUCCESS`;
export const SIGN_IN_SUCCESS = `${prefix}/SIGN_IN_SUCCESS`;

/**
 * Reducer
 * */
export const ReducerRecord = Record({
  user: null,
  loading: false,
  error: null,
});

export default function reducer(state = new ReducerRecord(), action) {
  const { type, payload, error } = action;

  switch (type) {
    case SIGN_UP_START:
      return state.set("loading", true);

    case SIGN_IN_SUCCESS:
      return state
        .set("loading", false)
        .set("user", payload.user)
        .set("error", null);

    case SIGN_OUT_SUCCESS:
      return state.set("user", null);

    case SIGN_UP_ERROR:
      return state.set("error", error).set("loading", false);

    default:
      return state;
  }
}

/**
 * Selectors
 * */

export const userSelector = (state) => state[moduleName].user;

/**
 * Custom Hooks
 */

export const useAuthorized = () => {
  const user = useSelector(userSelector);

  return !!user;
};

/**
 * Action Creators
 * */

export const signUp = (email, password) => ({
  type: SIGN_UP_REQUEST,
  payload: { email, password },
});

/**
 * Sagas
 */

export const signUpSaga = function* () {
  let errorCount = 0;

  while (true) {
    if (errorCount === 3) {
      yield put({
        type: SIGN_UP_TIMEOUT_LIMIT,
      });

      yield delay(1000);
    } else if (errorCount >= 5) {
      yield put({
        type: SIGN_UP_HARD_LIMIT,
      });

      return;
    }

    const {
      payload: { email, password },
    } = yield take(SIGN_UP_REQUEST);

    yield put({
      type: SIGN_UP_START,
    });

    try {
      const user = yield call(apiService.signUp, email, password);

      yield put({
        type: SIGN_UP_SUCCESS,
        payload: { user },
      });
    } catch (error) {
      errorCount++;

      yield put({
        type: SIGN_UP_ERROR,
        error,
      });
    }
  }
};

export const createAuthChanel = () =>
  eventChannel((emit) => apiService.onAuthChange((user) => emit({ user })));

export const syncAuthState = function* () {
  const chanel = yield call(createAuthChanel);

  while (true) {
    const { user } = yield take(chanel);

    if (user) {
      yield put({
        type: SIGN_IN_SUCCESS,
        payload: { user },
      });
    } else {
      yield put({
        type: SIGN_OUT_SUCCESS,
      });
    }
  }
};

export const saga = function* () {
  yield all([signUpSaga(), syncAuthState()]);
};
