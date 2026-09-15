import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import PixelLibraryPage from '@/pages/PixelLibraryPage.vue'
import Model3dLibraryPage from '@/pages/Model3dLibraryPage.vue'
import HabitatGuidePage from '@/pages/HabitatGuidePage.vue'
import MapEditorPage from '@/pages/MapEditorPage.vue'
import MapViewerPage from '@/pages/MapViewerPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: HomePage,
      redirect: '/pixel',
      children: [
        { path: 'pixel', name: 'pixel-library', component: PixelLibraryPage },
        { path: '3d', name: '3d-library', component: Model3dLibraryPage },
        { path: 'habitat', name: 'habitat', component: HabitatGuidePage },
      ],
    },
    { path: '/pixel/edit', name: 'pixel-edit', component: MapEditorPage },
    { path: '/pixel/view', name: 'pixel-view', component: MapViewerPage },
    {
      path: '/3d/edit',
      name: '3d-edit',
      component: () => import('@/pages/Map3DViewerPage.vue'),
    },
    {
      path: '/3d/view',
      name: '3d-view',
      component: () => import('@/pages/Map3DViewerPage.vue'),
    },
  ],
})
