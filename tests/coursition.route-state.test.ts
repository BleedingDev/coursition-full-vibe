import { describe, expect, test } from '@rstest/core';
import {
  sessionRedirectPathFor,
  snapshotLoadStatusFor,
  snapshotRouteKeyFor,
} from '../src/features/coursition/route-state';

const sessionUser = { email: 'evaluator@example.test', id: 'evaluator' };

describe('Coursition URL-driven route state', () => {
  test('waits for session resolution before deciding a redirect', () => {
    expect(
      sessionRedirectPathFor({
        isSessionResolved: false,
        language: 'en',
        routeKind: 'dashboard',
        sessionUser: null,
      }),
    ).toBeNull();
  });

  test('redirects protected and authentication URLs to their canonical destination', () => {
    expect(
      sessionRedirectPathFor({
        isSessionResolved: true,
        language: 'cs',
        routeKind: 'dashboard',
        sessionUser: null,
      }),
    ).toBe('/cs/prihlaseni');
    expect(
      sessionRedirectPathFor({
        isSessionResolved: true,
        language: 'en',
        routeKind: 'course',
        sessionUser: null,
      }),
    ).toBe('/en/sign-in');
    expect(
      sessionRedirectPathFor({
        isSessionResolved: true,
        language: 'en',
        routeKind: 'auth',
        sessionUser,
      }),
    ).toBe('/en/dashboard');
    expect(
      sessionRedirectPathFor({
        isSessionResolved: true,
        language: 'cs',
        routeKind: 'course',
        sessionUser,
      }),
    ).toBeNull();
  });

  test('keeps dashboard and course loads pending until their exact URL snapshot resolves', () => {
    const courseRoute = { draftId: 'course_123', language: 'en', step: 'sources' } as const;
    expect(snapshotRouteKeyFor('dashboard', null)).toBe('dashboard');
    expect(snapshotRouteKeyFor('course', courseRoute)).toBe('course_123:sources');
    expect(
      snapshotLoadStatusFor({
        errorRouteKey: null,
        loadedRouteKey: null,
        requestedRouteKey: 'dashboard',
      }),
    ).toBe('loading');
    expect(
      snapshotLoadStatusFor({
        errorRouteKey: null,
        loadedRouteKey: 'course_123:mode',
        requestedRouteKey: 'course_123:sources',
      }),
    ).toBe('loading');
    expect(
      snapshotLoadStatusFor({
        errorRouteKey: null,
        loadedRouteKey: 'course_123:sources',
        requestedRouteKey: 'course_123:sources',
      }),
    ).toBe('ready');
    expect(
      snapshotLoadStatusFor({
        errorRouteKey: 'course_123:sources',
        loadedRouteKey: null,
        requestedRouteKey: 'course_123:sources',
      }),
    ).toBe('error');
  });
});
