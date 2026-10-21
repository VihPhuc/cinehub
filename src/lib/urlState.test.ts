import { describe, expect, it } from 'vitest';
import { buildUrlSearch, parseUrlState } from './urlState';

function parsed(search: string) {
  return new URLSearchParams(buildUrlSearch(parseUrlState(search)));
}

describe('parseUrlState', () => {
  it('hydrates a watch deep link with episode', () => {
    const state = parseUrlState('?watch=dune&ep=2');

    expect(state.watchSlug).toBe('dune');
    expect(state.watchEpIdx).toBe(2);
  });

  it('hydrates info, genre, country and search links', () => {
    expect(parseUrlState('?info=dune').selectedSlug).toBe('dune');

    const genre = parseUrlState('?genre=hanh-dong&genreName=H%C3%A0nh%20%C4%91%E1%BB%99ng');
    expect(genre.activeTab).toBe('genre');
    expect(genre.genreFilter).toEqual({ slug: 'hanh-dong', name: 'Hành động' });

    const country = parseUrlState('?country=us&countryName=M%E1%BB%B9');
    expect(country.activeTab).toBe('country');
    expect(country.countryFilter).toEqual({ slug: 'us', name: 'Mỹ' });

    const search = parseUrlState('?q=dune&page=2');
    expect(search.activeTab).toBe('search');
    expect(search.searchQuery).toBe('dune');
    expect(search.currentPage).toBe(2);
  });

  it('search takes priority over genre and country', () => {
    const state = parseUrlState(
      '?tab=genre&genre=hanh-dong&genreName=H%C3%A0nh%20%C4%91%E1%BB%99ng&country=us&countryName=M%E1%BB%B9&q=dune'
    );

    expect(state.activeTab).toBe('search');
    expect(state.searchQuery).toBe('dune');
  });

  it('clamps invalid page and episode values', () => {
    expect(parseUrlState('?page=abc').currentPage).toBe(1);
    expect(parseUrlState('?page=-3').currentPage).toBe(1);
    expect(parseUrlState('?page=999999').currentPage).toBe(5000);
    expect(parseUrlState('?ep=abc').watchEpIdx).toBe(0);
    expect(parseUrlState('?ep=-5').watchEpIdx).toBe(0);
    expect(parseUrlState('?ep=999999').watchEpIdx).toBe(10000);
  });

  it('falls back to home for an empty genre/country/search tab', () => {
    expect(parseUrlState('?tab=genre').activeTab).toBe('home');
    expect(parseUrlState('?tab=country').activeTab).toBe('home');
    expect(parseUrlState('?tab=search&q=%20%20').activeTab).toBe('home');
    expect(parseUrlState('?tab=khong-ton-tai').activeTab).toBe('home');
  });
});

describe('buildUrlSearch', () => {
  const base = {
    activeTab: 'home',
    genreFilter: { slug: '', name: '' },
    countryFilter: { slug: '', name: '' },
    searchQuery: '',
    currentPage: 1,
    selectedSlug: null,
    watchSlug: null,
    watchEpIdx: 0,
  };

  it('round-trips watch links and omits ep=0', () => {
    expect(buildUrlSearch({ ...base, watchSlug: 'dune', watchEpIdx: 2 })).toBe('watch=dune&ep=2');
    expect(buildUrlSearch({ ...base, watchSlug: 'dune' })).toBe('watch=dune');
  });

  it('does not emit a redundant tab for search/genre/country', () => {
    const search = parsed('?q=dune');
    expect(search.get('tab')).toBeNull();
    expect(search.get('q')).toBe('dune');

    const genre = parsed('?genre=hanh-dong&genreName=H%C3%A0nh%20%C4%91%E1%BB%99ng');
    expect(genre.get('tab')).toBeNull();
    expect(genre.get('genre')).toBe('hanh-dong');
    expect(genre.get('genreName')).toBe('Hành động');

    const country = parsed('?country=us&countryName=M%E1%BB%B9');
    expect(country.get('tab')).toBeNull();
    expect(country.get('country')).toBe('us');
  });

  it('keeps info, catalog tabs and page', () => {
    expect(buildUrlSearch({ ...base, selectedSlug: 'dune' })).toBe('info=dune');
    expect(buildUrlSearch({ ...base, activeTab: 'library' })).toBe('tab=library');
    expect(buildUrlSearch({ ...base, activeTab: 'phim-le', currentPage: 3 })).toBe('tab=phim-le&page=3');
  });

  it('watch state wins over info and catalog state', () => {
    const search = parsed('?info=dune&tab=phim-le&page=3&watch=dune&ep=1');
    expect(search.get('watch')).toBe('dune');
    expect(search.get('info')).toBeNull();
    expect(search.get('tab')).toBeNull();
    expect(search.get('page')).toBeNull();
  });
});
