from django.urls import path
from . import views

urlpatterns = [
    path("stats/", views.stats),
    path("documents/", views.list_documents),
    path("documents/upload/", views.upload_document),
    path("documents/<str:fuente>/chunks/", views.document_chunks),
    path("documents/<str:fuente>/", views.delete_document),
    path("chat/", views.chat),
    path("search/", views.search),
]
