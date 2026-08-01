import { useEffect } from 'react';
import { SITE_URL } from './matching';

export function setMetaTag(attrName, attrValue, content) {
  let tag = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export const DEFAULT_TITLE = 'CareerBanyan — Jobs for India';
export const DEFAULT_DESC = 'Fresher and experienced job listings across India, updated daily.';

export function useDocumentHead(job) {
  useEffect(() => {
    if (job) {
      const title = `${job.role} at ${job.company} — CareerBanyan`;
      const rawDesc = `${job.role} at ${job.company} in ${job.city}. ${job.description && job.description[0] ? job.description[0] : ''}`;
      const desc = rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc;
      const url = `${SITE_URL}/job/${job.id}`;

      document.title = title;
      setMetaTag('name', 'description', desc);
      setMetaTag('property', 'og:title', title);
      setMetaTag('property', 'og:description', desc);
      setMetaTag('property', 'og:url', url);
      setCanonical(url);
    } else {
      document.title = DEFAULT_TITLE;
      setMetaTag('name', 'description', DEFAULT_DESC);
      setMetaTag('property', 'og:title', DEFAULT_TITLE);
      setMetaTag('property', 'og:description', DEFAULT_DESC);
      setMetaTag('property', 'og:url', `${SITE_URL}/`);
      setCanonical(`${SITE_URL}/`);
    }
  }, [job]);
}
